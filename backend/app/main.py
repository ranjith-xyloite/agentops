import asyncio
from fastapi import FastAPI
from app.api.routes import router as api_router
from app.database import session
from app.models import models
from app.config import settings
from sqlalchemy.ext.asyncio import create_async_engine

app = FastAPI(title="AgentOps - Phase 1")
app.include_router(api_router)

@app.on_event("startup")
async def startup_event():
    # create tables if not exists (simple approach for Phase 1)
    engine = create_async_engine(settings.DATABASE_URL, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    # seed sample data if empty
    from app.database.session import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        res = await session.execute(select(models.Project))
        if not res.scalars().first():
            p = models.Project(name="mom", description="MOM demo project", repository_url="https://example.com/mom.git")
            e1 = models.Environment(name="uat", description="UAT environment")
            e2 = models.Environment(name="qa", description="QA environment")
            session.add_all([p, e1, e2])
            await session.commit()
            # add project deployment
            await session.refresh(p)
            pd = models.ProjectDeployment(project_id=p.id, environment_id=e1.id, component="frontend", repository_path="/srv/mom/frontend", deployment_script="./deploy_frontend.sh", health_check_url="http://uat.example/health")
            session.add(pd)
            await session.commit()

@app.get("/")
async def root():
    return {"msg": "AgentOps Phase 1 backend running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.APP_HOST, port=settings.APP_PORT, reload=True)
