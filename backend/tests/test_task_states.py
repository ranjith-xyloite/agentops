import pytest
from app.services.task_service import TaskService
from app.schemas import ToolRequest

@pytest.mark.asyncio
async def test_task_lifecycle(tmp_path):
    svc = TaskService()
    parsed = ToolRequest(tool="deploy_frontend", parameters={"project":"mom","component":"frontend","branch":"qa","environment":"uat"}, requires_confirmation=True)
    task = await svc.create_task("Deploy MOM frontend QA to UAT", parsed)
    assert task.status in ("AWAITING_CONFIRMATION","PLANNED")
