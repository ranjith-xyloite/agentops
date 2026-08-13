import asyncio
from typing import Dict, Any
from app.database.session import AsyncSessionLocal
from app.models.models import ProjectDeployment, TaskExecution, Task
from sqlalchemy import select, update
import json

async def deploy_frontend(task_id: int, parameters: Dict[str, Any]):
    """Mock deploy_frontend tool.

    For Phase 1 this reads the configured ProjectDeployment for the project+environment+component
    and then simulates executing the deployment script. It writes one TaskExecution entry as the
    log container for output and returns structured result.
    """
    # open a session directly
    async with AsyncSessionLocal() as session:
        # find matching deployment
        project = parameters.get("project")
        component = parameters.get("component")
        environment = parameters.get("environment")
        stmt = select(ProjectDeployment).join(ProjectDeployment.project).where(
            ProjectDeployment.component == component
        )
        res = await session.execute(stmt)
        pd = res.scalars().first()

        # create TaskExecution row
        te = TaskExecution(task_id=task_id, tool_name="deploy_frontend", parameters=parameters, status="RUNNING")
        session.add(te)
        await session.commit()
        await session.refresh(te)

        logs = []
        async def emit(msg: str):
            logs.append(msg)
            te.output = "\n".join(logs)
            await session.commit()

        try:
            await emit("Connecting to server...")
            await asyncio.sleep(0.5)
            await emit(f"Navigating to repo path: {pd.repository_path if pd else 'unknown'}")
            await asyncio.sleep(0.5)
            branch = parameters.get("branch", "main")
            await emit(f"Checking out branch {branch}")
            await asyncio.sleep(0.6)
            await emit("Running deployment script...")
            await asyncio.sleep(1.0)
            await emit("Build complete")
            await asyncio.sleep(0.5)
            await emit("Restarting service/container...")
            await asyncio.sleep(0.5)
            # health check simulated
            await emit("Running post-deploy health check...")
            await asyncio.sleep(0.6)
            await emit("Health check OK")
            te.status = "SUCCESS"
            await session.commit()
        except Exception as e:
            te.status = "FAILED"
            te.error = str(e)
            await session.commit()
        finally:
            te.completed_at = te.completed_at or None
            await session.commit()
        return {"status": te.status, "output": te.output}
