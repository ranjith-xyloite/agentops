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


@pytest.mark.asyncio
async def test_project_and_deployment_crud(admin_headers, operator_headers):
    transport = ASGITransport(app=api_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create a Project (admin)
        res_create = await client.post(
            "/api/projects",
            json={
                "name": "billing-engine",
                "description": "Billing & invoice microservice",
                "repository_url": "https://github.com/example/billing"
            },
            headers=admin_headers
        )
        assert res_create.status_code == 200
        proj_data = res_create.json()
        proj_id = proj_data["id"]
        assert proj_data["name"] == "billing-engine"

        # 2. Operator cannot create deployment flow (403 Forbidden - Admin only)
        res_operator_denied = await client.post(
            f"/api/projects/{proj_id}/deployments",
            json={
                "environment_id": 1,
                "component": "api-service",
                "repository_path": "/opt/apps/billing/api",
                "deployment_script": "./deploy.sh",
                "health_check_url": "http://localhost:8080/health"
            },
            headers=operator_headers
        )
        assert res_operator_denied.status_code == 403

        # 3. Add Deployment Flow to the project (admin)
        res_deploy = await client.post(
            f"/api/projects/{proj_id}/deployments",
            json={
                "environment_id": 1,
                "component": "api-service",
                "repository_path": "/opt/apps/billing/api",
                "deployment_script": "./deploy.sh",
                "health_check_url": "http://localhost:8080/health"
            },
            headers=admin_headers
        )
        assert res_deploy.status_code == 200
        deploy_data = res_deploy.json()
        deploy_id = deploy_data["id"]
        assert deploy_data["component"] == "api-service"

        # 4. Delete the deployment flow (admin)
        res_del_deploy = await client.delete(
            f"/api/projects/deployments/{deploy_id}",
            headers=admin_headers
        )
        assert res_del_deploy.status_code == 200
        assert res_del_deploy.json()["status"] == "deleted"

        # 5. Delete the project (admin)
        res_del_proj = await client.delete(
            f"/api/projects/{proj_id}",
            headers=admin_headers
        )
        assert res_del_proj.status_code == 200
        assert res_del_proj.json()["status"] == "deleted"


@pytest.mark.asyncio
async def test_server_password_and_preflight_check(admin_headers, operator_headers):
    transport = ASGITransport(app=api_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create a server with password authentication
        res_srv = await client.post(
            "/api/servers",
            json={
                "name": "staging-node-pwd",
                "hostname": "127.0.0.1",
                "port": 2222,
                "username": "deployer",
                "environment_id": 2,
                "authentication_method": "password",
                "password": "SuperSecretPassword123!"
            },
            headers=admin_headers
        )
        assert res_srv.status_code == 200
        srv_data = res_srv.json()
        srv_id = srv_data["id"]
        assert srv_data["has_password"] is True
        assert srv_data["authentication_method"] == "password"

        # 2. Test server connection endpoint (will return result cleanly)
        res_test = await client.post(
            "/api/servers/test-connection",
            json={
                "hostname": "127.0.0.1",
                "port": 2222,
                "username": "deployer",
                "authentication_method": "password",
                "password": "SuperSecretPassword123!"
            },
            headers=operator_headers
        )
        assert res_test.status_code == 200
        data_test = res_test.json()
        assert "success" in data_test
        assert "message" in data_test

        # 3. Test pre-flight check endpoint for project on environment 1
        res_preflight = await client.post(
            "/api/deployments/preflight-check",
            json={
                "project_id": 1,
                "environment_id": 1,
                "component": "frontend"
            },
            headers=operator_headers
        )
        assert res_preflight.status_code == 200
        pre_data = res_preflight.json()
        assert "server_reachable" in pre_data
        assert len(pre_data["details"]) >= 1

        # 4. Update the created server (PUT /api/servers/{srv_id})
        res_update = await client.put(
            f"/api/servers/{srv_id}",
            json={
                "name": "staging-node-pwd-renamed",
                "hostname": "127.0.0.1",
                "port": 2223,
                "username": "deployer-updated",
                "environment_id": 2,
                "authentication_method": "password",
                "password": "UpdatedSuperSecret123!"
            },
            headers=admin_headers
        )
        assert res_update.status_code == 200
        upd_data = res_update.json()
        assert upd_data["name"] == "staging-node-pwd-renamed"
        assert upd_data["port"] == 2223
        assert upd_data["username"] == "deployer-updated"
        assert upd_data["has_password"] is True


@pytest.mark.asyncio
async def test_dual_login_username_and_email(admin_headers):
    transport = ASGITransport(app=api_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login with Username
        res_user = await client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        assert res_user.status_code == 200
        assert "access_token" in res_user.json()
        assert res_user.json()["user"]["username"] == "admin"

        # 2. Login with Email
        res_email = await client.post(
            "/api/auth/login",
            json={"username": "admin@test.local", "password": "admin123"}
        )
        assert res_email.status_code == 200
        assert "access_token" in res_email.json()
        assert res_email.json()["user"]["email"] == "admin@test.local"


@pytest.mark.asyncio
async def test_container_tagging_crud(admin_headers, operator_headers):
    transport = ASGITransport(app=api_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Add tag as Admin
        res_add = await client.post(
            "/api/containers/1/payment-service-container/tags",
            json={"tag": "payments"},
            headers=admin_headers
        )
        assert res_add.status_code == 200
        assert res_add.json()["status"] == "ok"

        # 2. Add duplicate tag (idempotent)
        res_dup = await client.post(
            "/api/containers/1/payment-service-container/tags",
            json={"tag": "payments"},
            headers=admin_headers
        )
        assert res_dup.status_code == 200

        # 3. Viewer/Operator cannot add tag
        res_unauth = await client.post(
            "/api/containers/1/payment-service-container/tags",
            json={"tag": "unauthorized-tag"},
            headers=operator_headers
        )
        assert res_unauth.status_code == 403

        # 4. Remove tag as Admin
        res_del = await client.delete(
            "/api/containers/1/payment-service-container/tags/payments",
            headers=admin_headers
        )
        assert res_del.status_code == 200
        assert res_del.json()["status"] == "ok"
