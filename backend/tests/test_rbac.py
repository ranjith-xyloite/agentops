import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_unauthenticated_request_blocked():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/servers")
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_viewer_role_restrictions(viewer_headers, operator_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Viewer can read servers and tasks
        res_read = await client.get("/api/servers", headers=viewer_headers)
        assert res_read.status_code == 200

        # Viewer CANNOT issue chat commands (mutation)
        res_chat = await client.post(
            "/api/chat",
            json={"message": "Deploy MOM frontend QA to UAT"},
            headers=viewer_headers
        )
        assert res_chat.status_code == 403

        # Operator CAN issue chat commands
        res_op_chat = await client.post(
            "/api/chat",
            json={"message": "Deploy MOM frontend QA to UAT"},
            headers=operator_headers
        )
        assert res_op_chat.status_code == 200


@pytest.mark.asyncio
async def test_operator_role_restrictions(operator_headers, admin_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Operator CANNOT create new infrastructure servers
        res_srv = await client.post(
            "/api/servers",
            json={"name": "test-srv", "hostname": "1.2.3.4", "environment_id": 1},
            headers=operator_headers
        )
        assert res_srv.status_code == 403

        # Admin CAN create new infrastructure servers
        res_admin_srv = await client.post(
            "/api/servers",
            json={"name": "test-srv", "hostname": "1.2.3.4", "environment_id": 1},
            headers=admin_headers
        )
        assert res_admin_srv.status_code == 200
        assert res_admin_srv.json()["name"] == "test-srv"


@pytest.mark.asyncio
async def test_admin_user_management(admin_headers, operator_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Operator cannot list users
        res_op = await client.get("/api/users", headers=operator_headers)
        assert res_op.status_code == 403

        # Admin can list users
        res_admin = await client.get("/api/users", headers=admin_headers)
        assert res_admin.status_code == 200
        users = res_admin.json()
        assert len(users) >= 3

        # Admin can create user
        res_create = await client.post(
            "/api/users",
            json={"username": "newdev", "email": "dev@test.local", "password": "password123", "role": "operator"},
            headers=admin_headers
        )
        assert res_create.status_code == 200
        assert res_create.json()["username"] == "newdev"
