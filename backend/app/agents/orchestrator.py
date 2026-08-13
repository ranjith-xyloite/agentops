from typing import Dict, Any
from app.llm.ollama import OllamaClient
from app.tools.registry import get_tool
from app.schemas import ToolRequest
from app.services.task_service import TaskService

llm = OllamaClient()

class Orchestrator:
    def __init__(self):
        self.task_service = TaskService()

    async def handle_user_message(self, user_message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        # Ask LLM for structured intent
        parsed: ToolRequest = await llm.parse(user_message, context)
        # Validate tool selection
        tool_callable = None
        if parsed.tool:
            tool_callable = get_tool(parsed.tool)
            if tool_callable is None:
                parsed.tool = None
                parsed.missing_information = parsed.missing_information or []
                parsed.missing_information.append("tool_not_allowed")
        # create task in DB with status PLANNED or AWAITING_CONFIRMATION
        task = await self.task_service.create_task(user_message, parsed)
        plan = {"task_id": task.id, "execution_plan": {"tool": parsed.tool, "parameters": parsed.parameters, "requires_confirmation": parsed.requires_confirmation}}
        return plan

    async def confirm_and_run(self, task_id: int) -> Dict[str, Any]:
        # transition and run
        task = await self.task_service.get_task(task_id)
        if not task:
            return {"error": "task_not_found"}
        if task.requires_confirmation and task.status != "AWAITING_CONFIRMATION":
            return {"error": "task_not_awaiting_confirmation"}
        # For simplicity: run the first tool indicated in last_message (stored when created)
        # In production, store parsed JSON in separate table
        parsed = await self.task_service.last_parsed_for_task(task_id)
        if not parsed or not parsed.tool:
            return {"error": "no_tool_parsed"}
        tool_fn = get_tool(parsed.tool)
        if not tool_fn:
            return {"error": "tool_not_allowed"}
        # run in background
        import asyncio
        asyncio.create_task(self.task_service.execute_tool(task_id, parsed.tool, parsed.parameters))
        return {"status": "started"}
