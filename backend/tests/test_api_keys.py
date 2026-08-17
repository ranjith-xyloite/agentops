import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_api_key_creation_and_auth(operator_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create API key
        res = await client.post(
            "/api/api-keys",
            json={"name": "github-actions-key", "expires_in_days": 30},
            headers=operator_headers
        )
        assert res.status_code == 200
        key_data = res.json()
        assert "raw_key" in key_data
        raw_key = key_data["raw_key"]
        assert raw_key.startswith("agops_")

        # Authenticate with X-API-Key header to run chat command
        res_chat = await client.post(
            "/api/chat",
            json={"message": "Deploy MOM frontend QA to UAT"},
            headers={"X-API-Key": raw_key}
        )
        assert res_chat.status_code == 200
        assert "task_id" in res_chat.json()

        # Revoke API key
        key_id = key_data["id"]
        res_revoke = await client.delete(f"/api/api-keys/{key_id}", headers=operator_headers)
        assert res_revoke.status_code == 200

        # Attempt to use revoked API key
        res_revoked_chat = await client.post(
            "/api/chat",
            json={"message": "Deploy MOM frontend QA to UAT"},
            headers={"X-API-Key": raw_key}
        )
        assert res_revoked_chat.status_code == 401
