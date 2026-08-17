"""
Tests for AgentOps REST and Streaming API endpoints.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.api.routes import router
from fastapi import FastAPI

api_test_app = FastAPI()
api_test_app.include_router(router)


@pytest.mark.asyncio
async def test_api_health():
    transport = ASGITransport(app=api_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] in ("ok", "healthy")


@pytest.mark.asyncio
async def test_api_stats(operator_headers):
    transport = ASGITransport(app=api_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/stats", headers=operator_headers)
        assert res.status_code == 200
        data = res.json()
        assert "total_tasks" in data
        assert "total_servers" in data
        assert data["total_projects"] >= 1


@pytest.mark.asyncio
async def test_api_chat_and_confirm(mock_ssh_executor, operator_headers):
    transport = ASGITransport(app=api_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Chat
        res = await client.post(
            "/api/chat",
            json={"message": "Deploy MOM frontend QA branch to UAT"},
            headers=operator_headers
        )
        assert res.status_code == 200
        data = res.json()
        assert "task_id" in data
        task_id = data["task_id"]
        assert data["execution_plan"]["requires_confirmation"] is True

        # Confirm
        res_confirm = await client.post(f"/api/tasks/{task_id}/confirm", headers=operator_headers)
        assert res_confirm.status_code == 200
        assert res_confirm.json()["status"] == "started"

        import asyncio
        await asyncio.sleep(0.2)

        # Check task details
        res_task = await client.get(f"/api/tasks/{task_id}", headers=operator_headers)
        assert res_task.status_code == 200
        assert res_task.json()["id"] == task_id


@pytest.mark.asyncio
async def test_api_list_projects_and_servers(operator_headers):
    transport = ASGITransport(app=api_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res_proj = await client.get("/api/projects", headers=operator_headers)
        assert res_proj.status_code == 200
        assert len(res_proj.json()) >= 1

        res_srv = await client.get("/api/servers", headers=operator_headers)
        assert res_srv.status_code == 200
        assert len(res_srv.json()) >= 1
