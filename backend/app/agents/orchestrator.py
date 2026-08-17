import asyncio
from typing import Dict, Any, Optional
from app.llm.multillm import multi_llm
from app.tools.registry import get_tool
from app.schemas import ToolRequest
from app.services.task_service import TaskService
from app.services.policy_engine import policy_engine


class Orchestrator:
    def __init__(self):
        self.task_service = TaskService()

    async def handle_user_message(self, user_message: str, context: Dict[str, Any], user_id: Optional[int] = None, user_role: str = "operator") -> Dict[str, Any]:
        # Ask Multi-LLM provider for structured intent / DAG pipeline
        parsed: ToolRequest = await multi_llm.parse(user_message, context)

        # Validate tool selection against allowlist
        if parsed.tool:
            tool_callable = get_tool(parsed.tool)
            if tool_callable is None:
                parsed.tool = None
                parsed.missing_information = parsed.missing_information or []
                parsed.missing_information.append("tool_not_allowed")

        # Evaluate DevOps Policies & Deployment Guardrails
        if parsed.tool:
            is_allowed, policy_rejection = await policy_engine.evaluate_task(
                parsed.tool,
                parsed.parameters or {},
                current_user_role=user_role
            )
            if not is_allowed:
                parsed.question = f"⚠️ [POLICY BLOCKED] {policy_rejection}"
                parsed.tool = None
                parsed.requires_confirmation = False

        # Create task in DB with status PLANNED or AWAITING_CONFIRMATION
        task = await self.task_service.create_task(user_request=user_message, parsed=parsed, user_id=user_id)

        # Auto-execute read-only / low-risk tasks that do not require confirmation
        if not parsed.requires_confirmation and (parsed.tool or (parsed.steps and len(parsed.steps) > 0)):
            asyncio.create_task(self.task_service.execute_task_plan(task.id))
            initial_status = "RUNNING"
        else:
            initial_status = "AWAITING_CONFIRMATION" if parsed.requires_confirmation else "PLANNED"

        plan = {
            "task_id": task.id,
            "status": initial_status,
            "execution_plan": {
                "tool": parsed.tool,
                "parameters": parsed.parameters,
                "requires_confirmation": parsed.requires_confirmation,
                "confidence": parsed.confidence,
                "missing_information": parsed.missing_information,
                "question": parsed.question,
                "steps": [s.model_dump() for s in parsed.steps] if parsed.steps else None,
            }
        }
        return plan

    async def confirm_and_run(self, task_id: int) -> Dict[str, Any]:
        task = await self.task_service.get_task(task_id)
        if not task:
            return {"error": "task_not_found"}
        if task.requires_confirmation and task.status not in ("AWAITING_CONFIRMATION", "PLANNED"):
            return {"error": f"task_not_awaiting_confirmation (current: {task.status})"}

        parsed = await self.task_service.last_parsed_for_task(task_id)
        if not parsed or (not parsed.tool and not parsed.steps):
            return {"error": "no_tool_parsed"}

        # Run execution asynchronously in background
        asyncio.create_task(self.task_service.execute_task_plan(task_id))
        return {"status": "started", "task_id": task_id}

    async def cancel_task(self, task_id: int) -> Dict[str, Any]:
        cancelled = await self.task_service.cancel_task(task_id)
        if not cancelled:
            return {"error": "task_not_cancellable_or_not_found"}
        return {"status": "cancelled", "task_id": task_id}
