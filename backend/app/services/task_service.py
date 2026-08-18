import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Set
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database.session import AsyncSessionLocal
from app.models.models import Task, TaskExecution
from app.schemas import ToolRequest, WorkflowStep
from app.services.webhook_service import webhook_dispatcher

logger = logging.getLogger(__name__)


class TaskBroadcaster:
    """Pub/Sub broadcaster for real-time Task log streaming (SSE)."""
    def __init__(self):
        self._subscribers: Dict[int, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, task_id: int) -> asyncio.Queue:
        async with self._lock:
            if task_id not in self._subscribers:
                self._subscribers[task_id] = set()
            q: asyncio.Queue = asyncio.Queue(maxsize=100)
            self._subscribers[task_id].add(q)
            return q

    async def unsubscribe(self, task_id: int, q: asyncio.Queue):
        async with self._lock:
            if task_id in self._subscribers:
                self._subscribers[task_id].discard(q)
                if not self._subscribers[task_id]:
                    del self._subscribers[task_id]

    async def broadcast(self, task_id: int, event_data: Dict[str, Any]):
        async with self._lock:
            queues = list(self._subscribers.get(task_id, []))
        for q in queues:
            try:
                q.put_nowait(event_data)
            except asyncio.QueueFull:
                pass


task_broadcaster = TaskBroadcaster()


class TaskService:
    def __init__(self):
        self._cancelled_tasks: Set[int] = set()

    def is_cancelled(self, task_id: int) -> bool:
        return task_id in self._cancelled_tasks

    async def cancel_task(self, task_id: int) -> bool:
        self._cancelled_tasks.add(task_id)
        async with AsyncSessionLocal() as session:
            t = await session.get(Task, task_id)
            if not t:
                return False
            if t.status in ("SUCCESS", "FAILED", "CANCELLED", "ROLLED_BACK"):
                return False
            t.status = "CANCELLED"
            t.completed_at = datetime.now(timezone.utc)
            t.last_message = "Task was cancelled by user."
            
            stmt = select(TaskExecution).where(TaskExecution.task_id == task_id, TaskExecution.status == "RUNNING")
            res = await session.execute(stmt)
            for te in res.scalars().all():
                te.status = "CANCELLED"
                te.completed_at = datetime.now(timezone.utc)
                te.error = "Execution cancelled."
                
            await session.commit()
            
        await task_broadcaster.broadcast(task_id, {
            "task_id": task_id,
            "status": "CANCELLED",
            "log": "[System] Task was cancelled by user.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        asyncio.create_task(webhook_dispatcher.dispatch_event("task.cancelled", {"task_id": task_id}))
        return True

    async def create_task(self, user_request: str, parsed: ToolRequest, user_id: Optional[int] = None) -> Task:
        async with AsyncSessionLocal() as session:
            steps_data = [s.model_dump() for s in parsed.steps] if parsed.steps else None
            intent_val = parsed.tool or parsed.question or "general"
            if len(intent_val) > 95:
                intent_val = intent_val[:92] + "..."
            t = Task(
                user_id=user_id,
                user_request=user_request,
                intent=intent_val,
                status="AWAITING_CONFIRMATION" if parsed.requires_confirmation else "PLANNED",
                requires_confirmation=parsed.requires_confirmation or False,
                workflow_dag=steps_data,
                current_step_index=0,
                last_message=json.dumps(parsed.model_dump())
            )
            session.add(t)
            await session.commit()
            await session.refresh(t)

        event_name = "task.awaiting_confirmation" if t.requires_confirmation else "task.created"
        asyncio.create_task(webhook_dispatcher.dispatch_event(event_name, {
            "task_id": t.id,
            "user_request": t.user_request,
            "requires_confirmation": t.requires_confirmation
        }))
        return t

    async def get_task(self, task_id: int) -> Optional[Task]:
        async with AsyncSessionLocal() as session:
            stmt = select(Task).options(selectinload(Task.executions)).where(Task.id == task_id)
            res = await session.execute(stmt)
            return res.scalars().first()

    async def last_parsed_for_task(self, task_id: int) -> Optional[ToolRequest]:
        async with AsyncSessionLocal() as session:
            t = await session.get(Task, task_id)
            if not t or not t.last_message:
                return None
            try:
                data = json.loads(t.last_message)
                return ToolRequest(**data)
            except Exception:
                return None

    async def emit_log(self, task_id: int, execution_id: Optional[int], message: str):
        """Emit real-time log to subscribers and update DB task output."""
        await task_broadcaster.broadcast(task_id, {
            "task_id": task_id,
            "execution_id": execution_id,
            "log": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

    async def execute_task_plan(self, task_id: int):
        """Executes single tool or full multi-step DAG pipeline based on task plan."""
        parsed = await self.last_parsed_for_task(task_id)
        if not parsed:
            return

        if parsed.steps and len(parsed.steps) > 0:
            await self.execute_workflow_dag(task_id, parsed.steps)
        elif parsed.tool:
            await self.execute_tool(task_id, parsed.tool, parsed.parameters or {})

    async def execute_workflow_dag(self, task_id: int, steps: List[WorkflowStep]):
        """Sequential DAG execution engine with auto-rollback on failure."""
        if self.is_cancelled(task_id):
            return

        async with AsyncSessionLocal() as session:
            t = await session.get(Task, task_id)
            if not t or t.status == "CANCELLED":
                return
            t.status = "RUNNING"
            t.started_at = datetime.now(timezone.utc)
            await session.commit()

        await task_broadcaster.broadcast(task_id, {
            "task_id": task_id,
            "status": "RUNNING",
            "log": f"🚀 Starting Multi-Step DAG Workflow ({len(steps)} steps planned)...",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        asyncio.create_task(webhook_dispatcher.dispatch_event("task.started", {"task_id": task_id, "total_steps": len(steps)}))

        from app.tools.registry import get_tool
        executed_steps: List[WorkflowStep] = []
        overall_success = True
        failure_reason = ""

        for idx, step in enumerate(steps):
            if self.is_cancelled(task_id):
                overall_success = False
                break

            step_num = idx + 1
            desc = step.description or step.tool
            await self.emit_log(task_id, None, f"\n▶ [Step {step_num}/{len(steps)}] {desc} (tool: {step.tool})...")

            tool_fn = get_tool(step.tool)
            if not tool_fn:
                overall_success = False
                failure_reason = f"Step {step_num} failed: Tool '{step.tool}' not allowed."
                await self.emit_log(task_id, None, f"❌ {failure_reason}")
                break

            # Execute step
            try:
                result = await tool_fn(task_id=task_id, parameters=step.parameters or {})
                step_status = result.get("status", "FAILED") if isinstance(result, dict) else "SUCCESS"
                step_output = result.get("output", "") if isinstance(result, dict) else str(result)
            except Exception as e:
                step_status = "FAILED"
                step_output = str(e)

            if step_status != "SUCCESS":
                overall_success = False
                failure_reason = f"Step {step_num} ({step.tool}) failed: {step_output}"
                await self.emit_log(task_id, None, f"❌ Step {step_num} Failed: {step_output}")
                break

            executed_steps.append(step)
            await self.emit_log(task_id, None, f"✔ Step {step_num} completed successfully.")

        if not overall_success and not self.is_cancelled(task_id):
            # Trigger Self-Healing & Automated Rollback
            await self.emit_log(task_id, None, "\n⚠️ [SELF-HEALING] Step failure detected. Initiating Automated Rollback Sequence...")
            await self._run_rollback_sequence(task_id, executed_steps)

            async with AsyncSessionLocal() as session:
                t = await session.get(Task, task_id)
                if t:
                    t.status = "ROLLED_BACK"
                    t.completed_at = datetime.now(timezone.utc)
                    t.last_message = f"Workflow failed and rolled back: {failure_reason}"
                    await session.commit()

            await task_broadcaster.broadcast(task_id, {
                "task_id": task_id,
                "status": "ROLLED_BACK",
                "log": f"🏁 Workflow finished with status: ROLLED_BACK",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            asyncio.create_task(webhook_dispatcher.dispatch_event("task.rolled_back", {"task_id": task_id, "reason": failure_reason}))
            return

        final_status = "CANCELLED" if self.is_cancelled(task_id) else ("SUCCESS" if overall_success else "FAILED")
        async with AsyncSessionLocal() as session:
            t = await session.get(Task, task_id)
            if t:
                t.status = final_status
                t.completed_at = datetime.now(timezone.utc)
                t.last_message = f"All {len(steps)} workflow steps executed successfully." if overall_success else failure_reason
                await session.commit()

        await task_broadcaster.broadcast(task_id, {
            "task_id": task_id,
            "status": final_status,
            "log": f"🏁 Pipeline finished with status: {final_status}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        asyncio.create_task(webhook_dispatcher.dispatch_event(f"task.{final_status.lower()}", {"task_id": task_id}))

    async def _run_rollback_sequence(self, task_id: int, steps_to_rollback: List[WorkflowStep]):
        """Executes rollbacks in reverse order for completed steps."""
        from app.tools.registry import get_tool
        for step in reversed(steps_to_rollback):
            if not step.rollback_tool:
                continue

            await self.emit_log(task_id, None, f"🔄 [Rollback] Executing {step.rollback_tool} for step '{step.description or step.tool}'...")
            tool_fn = get_tool(step.rollback_tool)
            if tool_fn:
                try:
                    await tool_fn(task_id=task_id, parameters=step.rollback_parameters or {})
                    await self.emit_log(task_id, None, f"✔ Rollback step {step.rollback_tool} succeeded.")
                except Exception as e:
                    await self.emit_log(task_id, None, f"⚠️ Rollback step error: {e}")

    async def execute_tool(self, task_id: int, tool_name: str, parameters: Dict[str, Any]):
        if self.is_cancelled(task_id):
            return

        async with AsyncSessionLocal() as session:
            t = await session.get(Task, task_id)
            if not t or t.status == "CANCELLED":
                return
            t.status = "RUNNING"
            t.started_at = datetime.now(timezone.utc)
            await session.commit()

        await task_broadcaster.broadcast(task_id, {
            "task_id": task_id,
            "status": "RUNNING",
            "log": f"Starting tool execution: {tool_name}...",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        asyncio.create_task(webhook_dispatcher.dispatch_event("task.started", {"task_id": task_id, "tool": tool_name}))

        from app.tools.registry import get_tool
        tool_fn = get_tool(tool_name)
        if not tool_fn:
            async with AsyncSessionLocal() as session:
                t = await session.get(Task, task_id)
                if t:
                    t.status = "FAILED"
                    t.completed_at = datetime.now(timezone.utc)
                    t.last_message = f"Tool '{tool_name}' is not allowed or registered."
                    await session.commit()
            await task_broadcaster.broadcast(task_id, {
                "task_id": task_id,
                "status": "FAILED",
                "log": f"Tool '{tool_name}' is not allowed.",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            asyncio.create_task(webhook_dispatcher.dispatch_event("task.failed", {"task_id": task_id, "tool": tool_name}))
            return

        try:
            result = await tool_fn(task_id=task_id, parameters=parameters)
            status = result.get("status", "FAILED") if isinstance(result, dict) else "SUCCESS"
            output = result.get("output", "") if isinstance(result, dict) else str(result)
        except Exception as exc:
            status = "FAILED"
            output = f"Execution error: {str(exc)}"

        if self.is_cancelled(task_id):
            status = "CANCELLED"

        async with AsyncSessionLocal() as session:
            t = await session.get(Task, task_id)
            if t and t.status != "CANCELLED":
                t.status = status
                t.completed_at = datetime.now(timezone.utc)
                t.last_message = output
                await session.commit()

        await task_broadcaster.broadcast(task_id, {
            "task_id": task_id,
            "status": status,
            "log": f"Tool execution finished with status: {status}",
            "output": output,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        asyncio.create_task(webhook_dispatcher.dispatch_event(f"task.{status.lower()}", {"task_id": task_id, "status": status}))


task_service = TaskService()


async def create_task_from_plan(user_request: str, tool: Optional[str], parameters: Dict[str, Any], requires_confirmation: bool) -> Task:
    parsed = ToolRequest(
        tool=tool,
        parameters=parameters,
        requires_confirmation=requires_confirmation
    )
    return await task_service.create_task(user_request, parsed)


async def get_task_with_executions(task_id: int) -> Optional[Task]:
    return await task_service.get_task(task_id)


async def cancel_task(task_id: int) -> Optional[Task]:
    success = await task_service.cancel_task(task_id)
    if success:
        return await task_service.get_task(task_id)
    return None


async def execute_confirmed_task(task_id: int):
    await task_service.execute_task_plan(task_id)
