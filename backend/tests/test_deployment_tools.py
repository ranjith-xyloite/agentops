"""
Tests for frontend and backend deployment execution tools.
"""
import pytest
from app.tools.deployment import deploy_frontend
from app.tools.docker_tools import deploy_backend
from app.services.task_service import TaskService
from app.schemas import ToolRequest


@pytest.mark.asyncio
async def test_deploy_frontend_success(mock_ssh_executor):
    svc = TaskService()
    task = await svc.create_task(
        "Deploy MOM frontend to UAT",
        ToolRequest(tool="deploy_frontend", parameters={"project": "mom", "component": "frontend", "environment": "uat", "branch": "main"})
    )
    result = await deploy_frontend(task.id, {
        "project": "mom",
        "component": "frontend",
        "environment": "uat",
        "branch": "main"
    })
    assert result["status"] == "SUCCESS"
    assert "Frontend deployment completed successfully" in result["output"]


@pytest.mark.asyncio
async def test_deploy_frontend_missing_config(mock_ssh_executor):
    svc = TaskService()
    task = await svc.create_task(
        "Deploy non-existent project",
        ToolRequest(tool="deploy_frontend", parameters={"project": "unknown", "component": "unknown", "environment": "uat"})
    )
    result = await deploy_frontend(task.id, {
        "project": "unknown",
        "component": "unknown",
        "environment": "uat"
    })
    assert result["status"] == "FAILED"
