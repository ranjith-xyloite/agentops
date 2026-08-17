import pytest
from app.core.security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token
)
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_password_hashing():
    pwd = "secret_password_123"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrong_password", hashed) is False


@pytest.mark.asyncio
async def test_jwt_lifecycle():
    data = {"sub": "42", "username": "testuser", "role": "operator"}
    token = create_access_token(data)
    decoded = decode_token(token)
    assert decoded["sub"] == "42"
    assert decoded["username"] == "testuser"
    assert decoded["role"] == "operator"
    assert decoded["type"] == "access"


@pytest.mark.asyncio
async def test_user_login_and_refresh_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login with operator credentials
        res = await client.post("/api/auth/login", json={"username": "operator", "password": "operator123"})
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["username"] == "operator"
        assert data["user"]["role"] == "operator"

        # Use refresh token
        refresh_res = await client.post("/api/auth/refresh", json={"refresh_token": data["refresh_token"]})
        assert refresh_res.status_code == 200
        assert "access_token" in refresh_res.json()

        # Access /api/auth/me with new token
        new_token = refresh_res.json()["access_token"]
        me_res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_token}"})
        assert me_res.status_code == 200
        assert me_res.json()["username"] == "operator"


@pytest.mark.asyncio
async def test_invalid_login():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/auth/login", json={"username": "operator", "password": "wrongpassword"})
        assert res.status_code == 401
