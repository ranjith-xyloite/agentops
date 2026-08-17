import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.webhook_service import webhook_dispatcher


@pytest.mark.asyncio
async def test_webhook_crud_and_dispatch(admin_headers, monkeypatch):
    async def mock_send(url, secret, event_type, data):
        return {"status_code": 200, "success": True}

    monkeypatch.setattr(webhook_dispatcher, "_send_webhook", mock_send)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create webhook
        payload = {
            "name": "DevOps Slack Channel",
            "url": "https://hooks.slack.com/services/test",
            "secret": "super_secret_signing_key_123",
            "event_types": ["task.failed", "task.rolled_back"]
        }
        res = await client.post("/api/webhooks", headers=admin_headers, json=payload)
        assert res.status_code == 200
        wh = res.json()
        wh_id = wh["id"]
        assert wh["name"] == "DevOps Slack Channel"

        # List webhooks
        list_res = await client.get("/api/webhooks", headers=admin_headers)
        assert list_res.status_code == 200
        assert any(w["id"] == wh_id for w in list_res.json())

        # Test event dispatching helper
        await webhook_dispatcher.dispatch_event("task.failed", {"task_id": 999, "reason": "test error"})

        # Delete webhook
        del_res = await client.delete(f"/api/webhooks/{wh_id}", headers=admin_headers)
        assert del_res.status_code == 200
