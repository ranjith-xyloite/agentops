"""
Pytest configuration and fixtures for AgentOps backend test suite.
Uses an isolated in-memory SQLite async database and mock executors.
"""
import asyncio
import pytest
import pytest_asyncio
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.models import (
    Base, Project, Environment, Server, ProjectDeployment,
    User, UserRole, ProjectMember, APIKey
)
import app.database.session as session_module
from app.core.ssh import CommandResult, SSHExecutor, SSHConnectionPool
from app.core.security import hash_password, create_access_token, generate_api_key


TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False
)
TestAsyncSessionLocal = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Automatically patch sessionmaker and initialize schema for each test."""
    session_module.set_engine_and_session(test_engine, TestAsyncSessionLocal)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Seed baseline fixtures
    async with TestAsyncSessionLocal() as session:
        env_uat = Environment(id=1, name="uat", description="UAT Environment")
        env_qa = Environment(id=2, name="qa", description="QA Environment")
        env_prod = Environment(id=3, name="production", description="Production Environment")
        session.add_all([env_uat, env_qa, env_prod])
        await session.commit()

        server1 = Server(
            id=1,
            name="uat-server-01",
            hostname="uat01.internal",
            port=22,
            username="deploy",
            environment_id=1,
            authentication_method="ssh_key"
        )
        server2 = Server(
            id=2,
            name="prod-server-01",
            hostname="prod01.internal",
            port=22,
            username="deploy",
            environment_id=3,
            authentication_method="ssh_key"
        )
        session.add_all([server1, server2])
        await session.commit()

        project = Project(
            id=1,
            name="mom",
            description="MOM Management Platform",
            repository_url="https://github.com/example/mom.git"
        )
        session.add(project)
        await session.commit()

        dep_fe = ProjectDeployment(
            id=1,
            project_id=1,
            environment_id=1,
            component="frontend",
            repository_path="/opt/mom/frontend",
            deployment_script="./deploy_frontend.sh",
            health_check_url="http://localhost:3000"
        )
        dep_be = ProjectDeployment(
            id=2,
            project_id=1,
            environment_id=1,
            component="backend",
            repository_path="/opt/mom/backend",
            deployment_script="./deploy_backend.sh",
            health_check_url="http://localhost:8000/health"
        )
        session.add_all([dep_fe, dep_be])
        await session.commit()

        # Seed Users
        u_admin = User(
            id=1,
            username="admin",
            email="admin@test.local",
            hashed_password=hash_password("admin123"),
            role=UserRole.ADMIN,
            is_active=True
        )
        u_operator = User(
            id=2,
            username="operator",
            email="operator@test.local",
            hashed_password=hash_password("operator123"),
            role=UserRole.OPERATOR,
            is_active=True
        )
        u_viewer = User(
            id=3,
            username="viewer",
            email="viewer@test.local",
            hashed_password=hash_password("viewer123"),
            role=UserRole.VIEWER,
            is_active=True
        )
        session.add_all([u_admin, u_operator, u_viewer])
        await session.commit()

        # Project memberships
        session.add_all([
            ProjectMember(user_id=2, project_id=1),
            ProjectMember(user_id=3, project_id=1),
        ])

        # Seed an API key for operator
        raw_key, prefix, key_hash = generate_api_key("ci-cd-key")
        api_key_obj = APIKey(
            id=1,
            user_id=2,
            name="ci-cd-key",
            key_prefix=prefix,
            key_hash=key_hash,
            is_active=True
        )
        session.add(api_key_obj)
        await session.commit()

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def admin_headers():
    token = create_access_token({"sub": "1", "username": "admin", "role": "admin"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def operator_headers():
    token = create_access_token({"sub": "2", "username": "operator", "role": "operator"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def viewer_headers():
    token = create_access_token({"sub": "3", "username": "viewer", "role": "viewer"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_ssh_executor(monkeypatch):
    """Fixture providing a mock SSH executor with configurable command responses."""
    mock_exec = AsyncMock(spec=SSHExecutor)

    def default_execute(host_key, command, timeout=300, env=None, cwd=None):
        if "docker ps" in command:
            stdout = '{"Id":"abc123456789","Names":"/mom-frontend","Image":"mom/frontend:latest","Status":"Up 2 hours"}\n'
            return CommandResult(exit_code=0, stdout=stdout, stderr="", duration_ms=25)
        elif "docker inspect" in command:
            return CommandResult(exit_code=0, stdout='"healthy"', stderr="", duration_ms=15)
        elif "curl" in command:
            return CommandResult(exit_code=0, stdout="200", stderr="", duration_ms=20)
        elif "df -h" in command:
            return CommandResult(exit_code=0, stdout="45\n", stderr="", duration_ms=10)
        elif "free" in command:
            return CommandResult(exit_code=0, stdout="52\n", stderr="", duration_ms=10)
        elif "uptime" in command:
            return CommandResult(exit_code=0, stdout="0.45\n", stderr="", duration_ms=10)
        elif "nproc" in command:
            return CommandResult(exit_code=0, stdout="4\n", stderr="", duration_ms=5)
        else:
            return CommandResult(exit_code=0, stdout="Success", stderr="", duration_ms=50)

    mock_exec.execute.side_effect = default_execute

    import app.tools.deployment as dep_mod
    import app.tools.docker_tools as doc_mod
    monkeypatch.setattr(dep_mod, "get_ssh_executor", lambda: mock_exec)
    monkeypatch.setattr(doc_mod, "get_ssh_executor", lambda: mock_exec)
    return mock_exec
