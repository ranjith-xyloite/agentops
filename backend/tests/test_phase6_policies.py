import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.policy_engine import policy_engine


@pytest.mark.asyncio
async def test_policy_crud_and_evaluation(admin_headers, operator_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create policy rule
        payload = {
            "name": "Production Freeze Policy",
            "environment": "production",
            "block_weekends": True,
            "allowed_hours_start": 9,
            "allowed_hours_end": 17,
            "require_double_confirm": True,
            "is_active": True
        }
        res = await client.post("/api/policies", headers=admin_headers, json=payload)
        assert res.status_code == 200
        p = res.json()
        p_id = p["id"]
        assert p["name"] == "Production Freeze Policy"

        # List policies
        list_res = await client.get("/api/policies", headers=operator_headers)
        assert list_res.status_code == 200
        assert any(rule["id"] == p_id for rule in list_res.json())

        # Test evaluation with read-only tool (should always be allowed)
        is_allowed, reason = await policy_engine.evaluate_task("server_health_check", {"environment": "production"})
        assert is_allowed is True

        # Delete policy
        del_res = await client.delete(f"/api/policies/{p_id}", headers=admin_headers)
        assert del_res.status_code == 200
