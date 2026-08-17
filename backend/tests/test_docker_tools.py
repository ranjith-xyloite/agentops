"""
Tests for Docker and infrastructure management tools.
"""
import pytest
import json
from app.tools import docker_tools
from app.services.task_service import TaskService
from app.schemas import ToolRequest


@pytest.mark.asyncio
async def test_docker_status_tool(mock_ssh_executor):
    """Test docker_status tool on UAT environment."""
    svc = TaskService()
    task = await svc.create_task("Check Docker status on UAT", ToolRequest(tool="docker_status", parameters={"environment": "uat"}))
    
    result = await docker_tools.docker_status(task.id, {"environment": "uat"})
    assert result["status"] == "SUCCESS"
    
    output_data = json.loads(result["output"])
    assert "containers" in output_data
    assert output_data["environment"] == "uat"
    assert output_data["count"] >= 1


@pytest.mark.asyncio
async def test_restart_container_tool(mock_ssh_executor):
    """Test restart_container tool with project and component."""
    svc = TaskService()
    task = await svc.create_task("Restart container on UAT", ToolRequest(tool="restart_container", parameters={"environment": "uat", "project": "mom", "component": "frontend"}))
    
    result = await docker_tools.restart_container(task.id, {
        "environment": "uat",
        "project": "mom",
        "component": "frontend"
    })
    assert result["status"] == "SUCCESS"
    assert "restarted" in result["output"].lower() or "Restarted" in result["output"]


@pytest.mark.asyncio
async def test_server_health_check_tool(mock_ssh_executor):
    """Test server_health_check tool performing HTTP, TCP, disk, memory, and CPU audits."""
    svc = TaskService()
    task = await svc.create_task("Health check on UAT servers", ToolRequest(tool="server_health_check", parameters={"environment": "uat"}))
    
    result = await docker_tools.server_health_check(task.id, {
        "environment": "uat",
        "checks": ["http", "tcp", "disk", "memory", "cpu"],
        "url": "http://localhost:8000/health",
        "port": 8000
    })
    assert result["status"] in ("SUCCESS", "WARNING")
    output_data = json.loads(result["output"])
    assert "results" in output_data
    assert len(output_data["results"]) > 0


@pytest.mark.asyncio
async def test_deploy_backend_tool(mock_ssh_executor):
    """Test deploy_backend tool execution with git checkout, script run, and health check."""
    svc = TaskService()
    task = await svc.create_task("Deploy MOM backend to UAT", ToolRequest(tool="deploy_backend", parameters={"project": "mom", "component": "backend", "environment": "uat", "branch": "main"}))
    
    result = await docker_tools.deploy_backend(task.id, {
        "project": "mom",
        "component": "backend",
        "environment": "uat",
        "branch": "main"
    })
    assert result["status"] == "SUCCESS"
    assert "Backend deployment finished successfully" in result["output"]