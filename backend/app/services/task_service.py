from typing import Dict, Any
from app.database.session import AsyncSessionLocal
from app.models.models import Task, TaskExecution
from app.schemas import ToolRequest
from datetime import datetime
import json

class TaskService:
    async def create_task(self, user_request: str, parsed: ToolRequest) -> Task:
        async with AsyncSessionLocal() as session:
            t = Task(user_request=user_request, intent=parsed.tool or parsed.question, status=("AWAITING_CONFIRMATION" if parsed.requires_confirmation else "PLANNED"), requires_confirmation=parsed.requires_confirmation, last_message=json.dumps(parsed.dict()))
            session.add(t)
            await session.commit()
            await session.refresh(t)
            return t

    async def get_task(self, task_id: int):
        async with AsyncSessionLocal() as session:
            t = await session.get(Task, task_id)
            return t

    async def last_parsed_for_task(self, task_id: int) -> ToolRequest:
        # For Phase 1 we store parsed JSON in last_message. This is async and minimal.
        # Note: in a real design, store parsed structured data in its own table.
        import json
        from app.schemas import ToolRequest
        async with AsyncSessionLocal() as session:
            t = await session.get(Task, task_id)
            if not t or not t.last_message:
                return None
            data = json.loads(t.last_message)
            return ToolRequest(**data)

    async def execute_tool(self, task_id: int, tool_name: str, parameters: Dict[str, Any]):
        # record start
        async with AsyncSessionLocal() as session:
            t = await session.get(Task, task_id)
            t.status = "RUNNING"
            t.started_at = datetime.utcnow()
            await session.commit()
        # import tool and run
        from app.tools.registry import get_tool
        tool_fn = get_tool(tool_name)
        if not tool_fn:
            async with AsyncSessionLocal() as session:
                t = await session.get(Task, task_id)
                t.status = "FAILED"
                t.completed_at = datetime.utcnow()
                t.last_message = "tool_not_allowed"
                await session.commit()
            return
        result = await tool_fn(task_id=task_id, parameters=parameters)
        async with AsyncSessionLocal() as session:
            t = await session.get(Task, task_id)
            t.status = result.get("status", "FAILED")
            t.completed_at = datetime.utcnow()
            t.last_message = result.get("output")
            await session.commit()
