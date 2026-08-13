from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.schemas import ChatRequest, ExecutionPlan, TaskOut
from app.agents.orchestrator import Orchestrator
from typing import Dict, Any
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api")
orchestrator = Orchestrator()

@router.post("/chat")
async def chat_endpoint(payload: ChatRequest):
    # context: list configured projects/environments/servers (Phase 1: minimal)
    context = {"allowed_tools": ["deploy_frontend","docker_status","restart_container","server_health_check"], "projects": ["mom"], "environments": ["uat","qa","production"]}
    plan = await orchestrator.handle_user_message(payload.message, context)
    return JSONResponse(plan)

@router.post("/tasks/{task_id}/confirm")
async def confirm_task(task_id: int):
    res = await orchestrator.confirm_and_run(task_id)
    if res.get("error"):
        raise HTTPException(status_code=400, detail=res)
    return res

@router.get("/tasks/{task_id}")
async def get_task(task_id: int):
    t = await orchestrator.task_service.get_task(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="not found")
    return TaskOut.from_orm(t)

@router.get("/tasks")
async def list_tasks():
    # simple list: return all tasks
    from app.database.session import AsyncSessionLocal
    from sqlalchemy import select
    from app.models.models import Task
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Task).order_by(Task.created_at.desc()).limit(50))
        tasks = res.scalars().all()
        return [TaskOut.from_orm(t) for t in tasks]

@router.get("/projects")
async def list_projects():
    from app.database.session import AsyncSessionLocal
    from app.models.models import Project
    from sqlalchemy import select
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Project))
        return [ {"id": p.id, "name": p.name} for p in res.scalars().all() ]

@router.get("/servers")
async def list_servers():
    from app.database.session import AsyncSessionLocal
    from app.models.models import Server
    from sqlalchemy import select
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Server))
        return [ {"id": s.id, "name": s.name, "hostname": s.hostname} for s in res.scalars().all() ]

@router.get("/health")
async def health():
    return {"status": "ok"}
