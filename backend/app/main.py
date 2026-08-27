import asyncio
import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app.api.routes import router as api_router
from app.config import settings
from app.database.session import engine, AsyncSessionLocal
from app.models.models import (
    Base, Project, Environment, Server, ProjectDeployment,
    User, UserRole, ProjectMember, ContainerTag
)
from app.core.security import hash_password
from app.core.logging_config import setup_structured_logging
from app.core.metrics import get_prometheus_metrics, SYSTEM_UPTIME_SECONDS
from app.middleware.observability import (
    CorrelationIdMiddleware,
    SecurityHeadersMiddleware,
    PrometheusMetricsMiddleware,
    RateLimitingMiddleware
)

# Initialize structured JSON logging
setup_structured_logging()
logger = logging.getLogger("agentops")
START_TIME = time.time()


async def init_db_and_seed():
    """Initialize tables and seed default baseline demo accounts and infrastructure."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Ensure Phase 6 columns exist on PostgreSQL if table was already created in earlier phases
        for col_stmt in [
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workflow_dag JSON",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS current_step_index INTEGER",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_rollback BOOLEAN DEFAULT FALSE",
            "ALTER TABLE task_executions ADD COLUMN IF NOT EXISTS is_rollback BOOLEAN DEFAULT FALSE",
            "ALTER TABLE servers ADD COLUMN IF NOT EXISTS password VARCHAR(255)",
            "ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_key TEXT",
            "ALTER TABLE project_deployments ADD COLUMN IF NOT EXISTS server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL",
            "ALTER TABLE servers ALTER COLUMN environment_id DROP NOT NULL",
        ]:
            try:
                await conn.execute(text(col_stmt))
            except Exception as e:
                logger.warning(f"Schema migration statement '{col_stmt}' skipped or failed: {e}")



    async with AsyncSessionLocal() as session:
        # Ensure all standard environments exist (develop, test, uat, qa, prod)
        standard_envs = [
            ("develop", "Development Environment"),
            ("test", "Test Environment"),
            ("uat", "UAT Environment"),
            ("qa", "QA Environment"),
            ("prod", "Production Environment"),
        ]
        for env_name, env_desc in standard_envs:
            res_env = await session.execute(select(Environment).where(Environment.name == env_name))
            if not res_env.scalars().first():
                session.add(Environment(name=env_name, description=env_desc))
        await session.commit()

        # Seed Users if empty
        user_res = await session.execute(select(User))
        if not user_res.scalars().first():
            u_admin = User(
                username="admin",
                email="admin@agentops.local",
                hashed_password=hash_password("admin123"),
                role=UserRole.ADMIN,
                is_active=True
            )
            u_operator = User(
                username="operator",
                email="operator@agentops.local",
                hashed_password=hash_password("operator123"),
                role=UserRole.OPERATOR,
                is_active=True
            )
            u_viewer = User(
                username="viewer",
                email="viewer@agentops.local",
                hashed_password=hash_password("viewer123"),
                role=UserRole.VIEWER,
                is_active=True
            )
            session.add_all([u_admin, u_operator, u_viewer])
            await session.commit()
            logger.info("Seeded initial RBAC users: admin, operator, viewer.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.scheduler import scheduler
    from app.core.ssh import initialize_ssh_pool_from_db
    try:
        await init_db_and_seed()
        await initialize_ssh_pool_from_db()
    except Exception as e:
        logger.warning(f"Database/SSH initialization note: {e}")

    # Start background Cron scheduler
    scheduler.start()
    yield
    # Stop scheduler gracefully on shutdown
    scheduler.stop()



app = FastAPI(
    title="AgentOps - AI DevOps Command Center",
    version="1.0.0",
    lifespan=lifespan
)

# 1. Correlation ID Middleware (outermost for all requests)
app.add_middleware(CorrelationIdMiddleware)

# 2. Rate Limiting Middleware (1200 requests/min general, 60 requests/min auth)
app.add_middleware(RateLimitingMiddleware, general_limit=1200, auth_limit=60, window_seconds=60)

# 3. Security Headers Middleware
app.add_middleware(SecurityHeadersMiddleware)

# 4. Prometheus Metrics Middleware
app.add_middleware(PrometheusMetricsMiddleware)

# 5. CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(api_router)


@app.get("/metrics", include_in_schema=False)
@app.get("/api/metrics", include_in_schema=True)
async def metrics_endpoint():
    """Prometheus metrics scraper endpoint."""
    SYSTEM_UPTIME_SECONDS.set(time.time() - START_TIME)
    return Response(
        content=get_prometheus_metrics(),
        media_type="text/plain; version=0.0.4; charset=utf-8"
    )


@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "AgentOps Backend API",
        "version": "1.0.0-phase6-final",
        "observability": "prometheus_enabled",
        "auth": "rbac_active",
        "docs": "/docs",
        "metrics": "/api/metrics"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.APP_HOST, port=settings.APP_PORT, reload=True)
