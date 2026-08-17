import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_audit_log_recording(admin_headers, operator_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Operator issues chat command
        await client.post(
            "/api/chat",
            json={"message": "Deploy MOM frontend QA to UAT"},
            headers=operator_headers
        )

        # Admin creates a server
        await client.post(
            "/api/servers",
            json={"name": "audit-server-node", "hostname": "10.0.0.99", "environment_id": 1},
            headers=admin_headers
        )

        # Inspect audit logs
        res = await client.get("/api/audit-logs", headers=admin_headers)
        assert res.status_code == 200
        logs = res.json()
        assert len(logs) >= 2

        actions = [l["action"] for l in logs]
        assert "chat_command" in actions
        assert "create_server" in actions
