import pytest
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.scheduler import matches_cron


def test_cron_matcher_syntax():
    dt = datetime(2026, 8, 17, 14, 30, tzinfo=timezone.utc)
    # Minute 30, Hour 14
    assert matches_cron("30 14 * * *", dt) is True
    assert matches_cron("*/15 14 * * *", dt) is True
    assert matches_cron("0 14 * * *", dt) is False
    assert matches_cron("* * * * *", dt) is True


@pytest.mark.asyncio
async def test_scheduled_tasks_crud_api(operator_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create schedule
        create_payload = {
            "name": "Nightly Fleet Health Scan",
            "cron_expression": "0 2 * * *",
            "user_request": "Run server health checks on production",
            "is_active": True
        }
        res = await client.post("/api/schedules", headers=operator_headers, json=create_payload)
        assert res.status_code == 200
        sched = res.json()
        sched_id = sched["id"]
        assert sched["name"] == "Nightly Fleet Health Scan"

        # List schedules
        list_res = await client.get("/api/schedules", headers=operator_headers)
        assert list_res.status_code == 200
        assert any(s["id"] == sched_id for s in list_res.json())

        # Toggle schedule
        toggle_res = await client.post(f"/api/schedules/{sched_id}/toggle", headers=operator_headers)
        assert toggle_res.status_code == 200
        assert toggle_res.json()["is_active"] is False

        # Delete schedule
        del_res = await client.delete(f"/api/schedules/{sched_id}", headers=operator_headers)
        assert del_res.status_code == 200
