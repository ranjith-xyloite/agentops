import pytest
from app.services.task_service import TaskService
from app.schemas import ToolRequest


@pytest.mark.asyncio
async def test_task_lifecycle():
    svc = TaskService()
    parsed = ToolRequest(
        tool="deploy_frontend",
        parameters={"project": "mom", "component": "frontend", "branch": "qa", "environment": "uat"},
        requires_confirmation=True
    )
    task = await svc.create_task("Deploy MOM frontend QA to UAT", parsed)
    assert task.status == "AWAITING_CONFIRMATION"
    assert task.requires_confirmation is True

    # Retrieve task
    fetched = await svc.get_task(task.id)
    assert fetched is not None
    assert fetched.id == task.id
    assert fetched.user_request == "Deploy MOM frontend QA to UAT"

    # Test task cancellation
    cancelled = await svc.cancel_task(task.id)
    assert cancelled is True

    fetched_after_cancel = await svc.get_task(task.id)
    assert fetched_after_cancel.status == "CANCELLED"
