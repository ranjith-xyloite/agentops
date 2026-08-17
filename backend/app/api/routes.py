import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload

from app.database.session import get_session
from app.models.models import (
    Task, TaskExecution, Server, Project, Environment, ProjectDeployment,
    User, UserRole, ProjectMember, APIKey, AuditLog,
    ScheduledTask, WebhookSubscription, PolicyRule
)
from app.schemas import (
    ChatRequest, ChatResponse, TaskOut, TaskExecutionOut, ToolRequest,
    ServerOut, ServerCreate, ServerUpdate, ProjectOut, ProjectCreate, ProjectUpdate, ProjectDeploymentCreate, ProjectDeploymentOut,
    EnvironmentOut, StatsOut,
    UserLogin, UserCreate, UserUpdate, UserOut, TokenResponse, TokenRefreshRequest,
    ProjectMemberAssign, APIKeyCreate, APIKeyOut, APIKeyCreatedOut, AuditLogOut,
    ScheduledTaskCreate, ScheduledTaskOut, WebhookSubscriptionCreate, WebhookSubscriptionOut,
    WebhookTestRequest, PolicyRuleCreate, PolicyRuleOut, LLMProviderConfig, LLMProviderOut,
    ServerTestConnectionRequest, ServerTestConnectionResponse, PreflightCheckRequest, PreflightCheckResponse
)
from app.llm.multillm import multi_llm
from app.services.webhook_service import webhook_dispatcher
from app.agents.orchestrator import Orchestrator
from app.core.ssh import test_ssh_connection, register_server_in_pool, get_ssh_executor

from app.services.task_service import (
    create_task_from_plan,
    get_task_with_executions,
    cancel_task,
    task_broadcaster,
    execute_confirmed_task
)
from app.core.security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token, generate_api_key
)
from app.api.deps import (
    get_current_user, require_role, get_user_accessible_projects,
    verify_project_access, log_audit_event
)

router = APIRouter(prefix="/api")
orchestrator = Orchestrator()


# =========================================================
# Public / Health & Kubernetes Observability Probes
# =========================================================

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0-phase6-final",
        "auth": "rbac_enabled",
        "observability": "prometheus_enabled",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/health/live")
async def k8s_liveness_probe():
    """Kubernetes Liveness probe checking application process responsiveness."""
    return {
        "status": "alive",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/health/ready")
async def k8s_readiness_probe():
    """Kubernetes Readiness probe verifying database connectivity and pool health."""
    from app.database.session import check_db_health
    db_health = await check_db_health()
    if db_health.get("status") != "healthy":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "unready", "database": db_health}
        )
    return {
        "status": "ready",
        "database": db_health,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/system/observability")
async def get_observability_data(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Aggregated observability data for frontend monitoring dashboard."""
    from app.database.session import check_db_health
    db_health = await check_db_health()
    
    total_tasks = (await session.execute(select(func.count(Task.id)))).scalar() or 0
    success_tasks = (await session.execute(select(func.count(Task.id)).where(Task.status == "SUCCESS"))).scalar() or 0
    failed_tasks = (await session.execute(select(func.count(Task.id)).where(Task.status == "FAILED"))).scalar() or 0
    running_tasks = (await session.execute(select(func.count(Task.id)).where(Task.status == "RUNNING"))).scalar() or 0
    
    success_rate = round((success_tasks / total_tasks * 100), 1) if total_tasks > 0 else 100.0

    return {
        "status": "healthy" if db_health.get("status") == "healthy" else "degraded",
        "database": db_health,
        "metrics": {
            "total_tasks": total_tasks,
            "success_tasks": success_tasks,
            "failed_tasks": failed_tasks,
            "running_tasks": running_tasks,
            "success_rate_percent": success_rate,
        },
        "k8s_probes": {
            "liveness": "PASSING",
            "readiness": "PASSING" if db_health.get("status") == "healthy" else "FAILING",
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }



# =========================================================
# Authentication & Profile Endpoints
# =========================================================

@router.post("/auth/register", response_model=UserOut)
async def register_user(
    payload: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_session)
):
    # Check if username or email already exists
    stmt = select(User).where((User.username == payload.username) | (User.email == payload.email))
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username or email already registered")

    # If first user, make admin automatically
    count_stmt = select(func.count(User.id))
    total_users = (await db.execute(count_stmt)).scalar() or 0
    assigned_role = UserRole.ADMIN if total_users == 0 else UserRole(payload.role)

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=assigned_role,
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await log_audit_event(
        db, user, "user_registered", "user", str(user.id),
        {"role": user.role.value}, request.client.host if request.client else None
    )

    out = UserOut.model_validate(user)
    out.role = user.role.value
    out.assigned_projects = await get_user_accessible_projects(user, db)
    return out


@router.post("/auth/login", response_model=TokenResponse)
async def login(
    payload: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_session)
):
    stmt = select(User).where(User.username == payload.username)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    access_token = create_access_token({"sub": str(user.id), "username": user.username, "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    await log_audit_event(
        db, user, "user_login", "user", str(user.id),
        {"username": user.username}, request.client.host if request.client else None
    )

    user_out = UserOut.model_validate(user)
    user_out.role = user.role.value
    user_out.assigned_projects = await get_user_accessible_projects(user, db)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_out
    )


@router.post("/auth/refresh")
async def refresh_token_endpoint(
    payload: TokenRefreshRequest,
    db: AsyncSession = Depends(get_session)
):
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = int(data["sub"])
        user = await db.get(User, user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User inactive or not found")

        new_access_token = create_access_token({
            "sub": str(user.id),
            "username": user.username,
            "role": user.role.value
        })
        return {"access_token": new_access_token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token refresh failed: {str(e)}")


@router.get("/auth/me", response_model=UserOut)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    out = UserOut.model_validate(current_user)
    out.role = current_user.role.value
    out.assigned_projects = await get_user_accessible_projects(current_user, db)
    return out


# =========================================================
# User Management (Admin Only)
# =========================================================

@router.get("/users", response_model=List[UserOut])
async def list_users(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_session)
):
    stmt = select(User).order_by(User.id.asc())
    res = await db.execute(stmt)
    users = res.scalars().all()

    result = []
    for u in users:
        u_out = UserOut.model_validate(u)
        u_out.role = u.role.value
        u_out.assigned_projects = await get_user_accessible_projects(u, db)
        result.append(u_out)
    return result


@router.post("/users", response_model=UserOut)
async def create_user(
    payload: UserCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_session)
):
    stmt = select(User).where((User.username == payload.username) | (User.email == payload.email))
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username or email already exists")

    new_user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=UserRole(payload.role),
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Assign multiple projects if provided
    if payload.project_ids:
        for pid in payload.project_ids:
            db.add(ProjectMember(user_id=new_user.id, project_id=pid))
        await db.commit()

    await log_audit_event(
        db, current_user, "admin_create_user", "user", str(new_user.id),
        {"created_username": new_user.username, "role": new_user.role.value, "project_ids": payload.project_ids},
        request.client.host if request.client else None
    )

    out = UserOut.model_validate(new_user)
    out.role = new_user.role.value
    out.assigned_projects = await get_user_accessible_projects(new_user, db)
    return out


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_session)
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email:
        user.email = payload.email
    if payload.role:
        user.role = UserRole(payload.role)
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password:
        user.hashed_password = hash_password(payload.password)

    if payload.project_ids is not None:
        await db.execute(delete(ProjectMember).where(ProjectMember.user_id == user.id))
        for pid in payload.project_ids:
            db.add(ProjectMember(user_id=user.id, project_id=pid))

    await db.commit()
    await db.refresh(user)

    await log_audit_event(
        db, current_user, "admin_update_user", "user", str(user.id),
        {"updated_username": user.username, "role": user.role.value, "project_ids": payload.project_ids},
        request.client.host if request.client else None
    )

    out = UserOut.model_validate(user)
    out.role = user.role.value
    out.assigned_projects = await get_user_accessible_projects(user, db)
    return out


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_session)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await log_audit_event(
        db, current_user, "admin_delete_user", "user", str(user.id),
        {"deleted_username": user.username}, request.client.host if request.client else None
    )

    await db.delete(user)
    await db.commit()
    return {"status": "deleted", "user_id": user_id}


@router.post("/users/{user_id}/projects")
async def assign_user_projects(
    user_id: int,
    payload: ProjectMemberAssign,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_session)
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Clear existing memberships and assign new ones
    await db.execute(delete(ProjectMember).where(ProjectMember.user_id == user_id))
    for pid in payload.project_ids:
        db.add(ProjectMember(user_id=user_id, project_id=pid))

    await db.commit()

    await log_audit_event(
        db, current_user, "assign_projects", "user", str(user.id),
        {"project_ids": payload.project_ids, "username": user.username},
        request.client.host if request.client else None
    )

    assigned = await get_user_accessible_projects(user, db)
    return {"status": "updated", "user_id": user_id, "assigned_projects": assigned}


# =========================================================
# API Key Management (CI/CD Integration)
# =========================================================

@router.get("/api-keys", response_model=List[APIKeyOut])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    stmt = select(APIKey).where(APIKey.user_id == current_user.id).order_by(APIKey.id.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/api-keys", response_model=APIKeyCreatedOut)
async def create_api_key_endpoint(
    payload: APIKeyCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.OPERATOR)),
    db: AsyncSession = Depends(get_session)
):
    raw_key, prefix, key_hash = generate_api_key(payload.name)
    expires_at = None
    if payload.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)

    api_key = APIKey(
        user_id=current_user.id,
        name=payload.name,
        key_prefix=prefix,
        key_hash=key_hash,
        expires_at=expires_at,
        is_active=True
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    await log_audit_event(
        db, current_user, "create_api_key", "api_key", str(api_key.id),
        {"name": payload.name, "prefix": prefix}, request.client.host if request.client else None
    )

    return APIKeyCreatedOut(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        raw_key=raw_key
    )


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    stmt = select(APIKey).where(APIKey.id == key_id)
    if current_user.role != UserRole.ADMIN:
        stmt = stmt.where(APIKey.user_id == current_user.id)

    res = await db.execute(stmt)
    key_obj = res.scalar_one_or_none()
    if not key_obj:
        raise HTTPException(status_code=404, detail="API key not found")

    await log_audit_event(
        db, current_user, "revoke_api_key", "api_key", str(key_obj.id),
        {"name": key_obj.name, "prefix": key_obj.key_prefix},
        request.client.host if request.client else None
    )

    await db.delete(key_obj)
    await db.commit()
    return {"status": "revoked", "key_id": key_id}


# =========================================================
# Security Audit Logs (Admin / Operator)
# =========================================================

@router.get("/audit-logs", response_model=List[AuditLogOut])
async def list_audit_logs(
    action: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_role(UserRole.OPERATOR)),
    db: AsyncSession = Depends(get_session)
):
    stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    res = await db.execute(stmt)
    return res.scalars().all()


# =========================================================
# Protected Core DevOps Endpoints (RBAC Gated)
# =========================================================

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    payload: ChatRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.OPERATOR)),
    db: AsyncSession = Depends(get_session)
):
    accessible_projects = await get_user_accessible_projects(current_user, db)
    servers_res = await db.execute(select(Server))
    server_names = [s.name for s in servers_res.scalars().all()]
    envs_res = await db.execute(select(Environment))
    env_names = [e.name for e in envs_res.scalars().all()]

    context = {
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role.value,
        "allowed_projects": accessible_projects,
        "projects": accessible_projects,
        "servers": server_names,
        "environments": env_names,
        "allowed_tools": [
            "deploy_frontend", "deploy_backend", "docker_status",
            "restart_container", "server_health_check"
        ]
    }

    plan_dict = await orchestrator.handle_user_message(
        payload.message,
        context,
        user_id=current_user.id,
        user_role=current_user.role.value
    )
    exec_plan = plan_dict.get("execution_plan", {})
    params = exec_plan.get("parameters") or {}
    target_project = params.get("project")

    if target_project and current_user.role != UserRole.ADMIN:
        if target_project not in accessible_projects:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You do not have permissions for project '{target_project}'."
            )

    task_id = plan_dict["task_id"]
    task = await db.get(Task, task_id)
    if task:
        task.user_id = current_user.id
        await db.commit()

    await log_audit_event(
        db, current_user, "chat_command", "task", str(task_id),
        {"tool": exec_plan.get("tool"), "requires_confirmation": exec_plan.get("requires_confirmation"), "request": payload.message},
        request.client.host if request.client else None
    )

    return ChatResponse(
        task_id=task_id,
        status=plan_dict["status"],
        execution_plan=ToolRequest(**exec_plan)
    )


@router.post("/tasks/{task_id}/confirm")
async def confirm_task_endpoint(
    task_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.OPERATOR)),
    db: AsyncSession = Depends(get_session)
):
    task = await get_task_with_executions(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await log_audit_event(
        db, current_user, "task_confirmed", "task", str(task_id),
        {"user_request": task.user_request}, request.client.host if request.client else None
    )

    asyncio.create_task(execute_confirmed_task(task_id))
    return {"status": "started", "task_id": task_id}


@router.post("/tasks/{task_id}/cancel")
async def cancel_task_endpoint(
    task_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.OPERATOR)),
    db: AsyncSession = Depends(get_session)
):
    task = await cancel_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await log_audit_event(
        db, current_user, "task_cancelled", "task", str(task_id),
        {"user_request": task.user_request}, request.client.host if request.client else None
    )

    return {"status": "cancelled", "task_id": task_id}


@router.get("/tasks/{task_id}/events")
async def stream_task_events(
    task_id: int,
    current_user: User = Depends(get_current_user)
):
    task = await get_task_with_executions(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    async def event_generator():
        executions_data = [
            {"id": e.id, "tool_name": e.tool_name, "status": e.status, "output": e.output}
            for e in (task.executions or [])
        ]
        init_payload = {
            "type": "init",
            "task_id": task.id,
            "status": task.status,
            "executions": executions_data
        }
        yield f"data: {json.dumps(init_payload)}\n\n"

        queue = await task_broadcaster.subscribe(task_id)
        try:
            while True:
                data = await queue.get()
                yield f"data: {json.dumps(data)}\n\n"
                if data.get("status") in ["SUCCESS", "FAILED", "CANCELLED"] or data.get("type") == "complete":
                    break
        finally:
            await task_broadcaster.unsubscribe(task_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/tasks", response_model=List[TaskOut])
async def list_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    stmt = select(Task).options(selectinload(Task.executions)).order_by(Task.id.desc())
    if status_filter:
        stmt = stmt.where(Task.status == status_filter)
    res = await session.execute(stmt)
    return res.scalars().all()


@router.get("/tasks/{task_id}")
async def get_task_endpoint(
    task_id: int,
    current_user: User = Depends(get_current_user)
):
    task = await get_task_with_executions(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "id": task.id,
        "user_request": task.user_request,
        "intent": task.intent,
        "status": task.status,
        "requires_confirmation": task.requires_confirmation,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "started_at": task.started_at.isoformat() if task.started_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "last_message": task.last_message,
        "executions": [
            {
                "id": e.id,
                "tool_name": e.tool_name,
                "parameters": e.parameters,
                "output": e.output,
                "error": e.error,
                "status": e.status,
                "started_at": e.started_at.isoformat() if e.started_at else None,
                "completed_at": e.completed_at.isoformat() if e.completed_at else None,
            }
            for e in (task.executions or [])
        ]
    }


# =========================================================
# Infrastructure & Project Endpoints
# =========================================================

@router.get("/projects", response_model=List[ProjectOut])
async def list_projects(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    stmt = (
        select(Project)
        .options(selectinload(Project.deployments).selectinload(ProjectDeployment.server))
        .order_by(Project.id.asc())
    )
    if current_user.role != UserRole.ADMIN:
        stmt = (
            stmt.join(ProjectMember, ProjectMember.project_id == Project.id)
            .where(ProjectMember.user_id == current_user.id)
        )
    res = await session.execute(stmt)
    projects = res.scalars().all()
    out = []
    for p in projects:
        p_out = ProjectOut(
            id=p.id,
            name=p.name,
            description=p.description,
            repository_url=p.repository_url,
            deployments=[
                ProjectDeploymentOut(
                    id=d.id,
                    project_id=d.project_id,
                    environment_id=d.environment_id,
                    server_id=d.server_id,
                    server_name=d.server.name if d.server else None,
                    server_hostname=d.server.hostname if d.server else None,
                    component=d.component,
                    repository_path=d.repository_path,
                    deployment_script=d.deployment_script,
                    health_check_url=d.health_check_url
                )
                for d in (p.deployments or [])
            ]
        )
        out.append(p_out)
    return out


@router.post("/projects", response_model=ProjectOut)
async def create_project(
    payload: ProjectCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    p = Project(
        name=payload.name,
        description=payload.description,
        repository_url=payload.repository_url
    )
    session.add(p)
    await session.commit()
    await session.refresh(p)

    await log_audit_event(
        session, current_user, "create_project", "project", str(p.id),
        {"name": p.name}, request.client.host if request.client else None
    )
    return p


@router.put("/projects/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: int,
    payload: ProjectUpdate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.name is not None:
        project.name = payload.name
    if payload.description is not None:
        project.description = payload.description
    if payload.repository_url is not None:
        project.repository_url = payload.repository_url

    await session.commit()
    await session.refresh(project)

    await log_audit_event(
        session, current_user, "update_project", "project", str(project.id),
        {"name": project.name}, request.client.host if request.client else None
    )
    return project



@router.post("/projects/{project_id}/deployments", response_model=ProjectDeploymentOut)
async def create_project_deployment(
    project_id: int,
    payload: ProjectDeploymentCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    env = await session.get(Environment, payload.environment_id)
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")

    if payload.server_id:
        server = await session.get(Server, payload.server_id)
        if not server:
            raise HTTPException(status_code=404, detail="Target Fleet Server Node not found")

    pd = ProjectDeployment(
        project_id=project_id,
        environment_id=payload.environment_id,
        server_id=payload.server_id,
        component=payload.component,
        repository_path=payload.repository_path,
        deployment_script=payload.deployment_script,
        health_check_url=payload.health_check_url
    )
    session.add(pd)
    await session.commit()
    await session.refresh(pd)

    # Load server info if mapped
    server_obj = await session.get(Server, pd.server_id) if pd.server_id else None

    await log_audit_event(
        session, current_user, "create_project_deployment", "project_deployment", str(pd.id),
        {"project_id": project_id, "component": pd.component, "environment_id": pd.environment_id, "server_id": pd.server_id},
        request.client.host if request.client else None
    )

    out = ProjectDeploymentOut.model_validate(pd)
    if server_obj:
        out.server_name = server_obj.name
        out.server_hostname = server_obj.hostname
    return out


@router.put("/projects/deployments/{deployment_id}", response_model=ProjectDeploymentOut)
async def update_project_deployment(
    deployment_id: int,
    payload: ProjectDeploymentCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    pd = await session.get(ProjectDeployment, deployment_id)
    if not pd:
        raise HTTPException(status_code=404, detail="Deployment flow not found")

    if payload.server_id:
        server = await session.get(Server, payload.server_id)
        if not server:
            raise HTTPException(status_code=404, detail="Target Fleet Server Node not found")

    if payload.component is not None:
        pd.component = payload.component
    if payload.environment_id is not None:
        pd.environment_id = payload.environment_id
    if payload.server_id is not None:
        pd.server_id = payload.server_id
    if payload.repository_path is not None:
        pd.repository_path = payload.repository_path
    if payload.deployment_script is not None:
        pd.deployment_script = payload.deployment_script
    if payload.health_check_url is not None:
        pd.health_check_url = payload.health_check_url

    await session.commit()
    await session.refresh(pd)

    server_obj = await session.get(Server, pd.server_id) if pd.server_id else None

    await log_audit_event(
        session, current_user, "update_project_deployment", "project_deployment", str(pd.id),
        {"component": pd.component, "repo_path": pd.repository_path, "script": pd.deployment_script, "server_id": pd.server_id},
        request.client.host if request.client else None
    )

    out = ProjectDeploymentOut.model_validate(pd)
    if server_obj:
        out.server_name = server_obj.name
        out.server_hostname = server_obj.hostname
    return out



@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    stmt_del = select(ProjectDeployment).where(ProjectDeployment.project_id == project_id)
    res_del = await session.execute(stmt_del)
    for d in res_del.scalars().all():
        await session.delete(d)

    await log_audit_event(
        session, current_user, "delete_project", "project", str(project.id),
        {"name": project.name}, request.client.host if request.client else None
    )
    await session.delete(project)
    await session.commit()
    return {"status": "deleted", "project_id": project_id}


@router.delete("/projects/deployments/{deployment_id}")
async def delete_project_deployment(
    deployment_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    pd = await session.get(ProjectDeployment, deployment_id)
    if not pd:
        raise HTTPException(status_code=404, detail="Deployment flow not found")

    await log_audit_event(
        session, current_user, "delete_project_deployment", "project_deployment", str(pd.id),
        {"component": pd.component, "project_id": pd.project_id},
        request.client.host if request.client else None
    )
    await session.delete(pd)
    await session.commit()
    return {"status": "deleted", "deployment_id": deployment_id}



@router.get("/environments", response_model=List[EnvironmentOut])
async def list_environments(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    stmt = select(Environment).options(selectinload(Environment.servers)).order_by(Environment.id.asc())
    res = await session.execute(stmt)
    return res.scalars().all()


@router.get("/servers", response_model=List[ServerOut])
async def list_servers(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    stmt = select(Server).options(selectinload(Server.environment)).order_by(Server.id.asc())
    res = await session.execute(stmt)
    servers = res.scalars().all()
    out = []
    for s in servers:
        s_out = ServerOut.model_validate(s)
        s_out.environment_name = s.environment.name if s.environment else None
        s_out.has_password = bool(s.password)
        out.append(s_out)
    return out


@router.post("/servers", response_model=ServerOut)
async def create_server(
    payload: ServerCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    s = Server(
        name=payload.name,
        hostname=payload.hostname,
        port=payload.port,
        username=payload.username,
        environment_id=payload.environment_id,
        authentication_method=payload.authentication_method,
        password=payload.password,
        ssh_key=payload.ssh_key
    )
    session.add(s)
    await session.commit()
    await session.refresh(s)

    register_server_in_pool(s)

    await log_audit_event(
        session, current_user, "create_server", "server", str(s.id),
        {"name": s.name, "hostname": s.hostname, "auth_method": s.authentication_method},
        request.client.host if request.client else None
    )

    out = ServerOut.model_validate(s)
    out.has_password = bool(s.password)
    return out


@router.put("/servers/{server_id}", response_model=ServerOut)
async def update_server(
    server_id: int,
    payload: ServerUpdate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    s = await session.get(Server, server_id)
    if not s:
        raise HTTPException(status_code=404, detail="Server not found")

    if payload.name is not None:
        s.name = payload.name
    if payload.hostname is not None:
        s.hostname = payload.hostname
    if payload.port is not None:
        s.port = payload.port
    if payload.username is not None:
        s.username = payload.username
    if payload.environment_id is not None:
        s.environment_id = payload.environment_id
    if payload.authentication_method is not None:
        s.authentication_method = payload.authentication_method
    if payload.password is not None and payload.password != "":
        s.password = payload.password
    if payload.ssh_key is not None:
        s.ssh_key = payload.ssh_key

    await session.commit()
    await session.refresh(s)
    register_server_in_pool(s)

    await log_audit_event(
        session, current_user, "update_server", "server", str(s.id),
        {"name": s.name, "hostname": s.hostname, "auth_method": s.authentication_method},
        request.client.host if request.client else None
    )

    out = ServerOut.model_validate(s)
    out.has_password = bool(s.password)
    return out



@router.post("/servers/test-connection", response_model=ServerTestConnectionResponse)
async def test_server_connection(
    payload: ServerTestConnectionRequest,
    current_user: User = Depends(require_role(UserRole.OPERATOR))
):
    res = await test_ssh_connection(
        host=payload.hostname,
        port=payload.port,
        username=payload.username,
        password=payload.password,
        key_path=payload.ssh_key
    )
    return ServerTestConnectionResponse(**res)


@router.post("/servers/{server_id}/test-connection", response_model=ServerTestConnectionResponse)
async def test_existing_server_connection(
    server_id: int,
    current_user: User = Depends(require_role(UserRole.OPERATOR)),
    session: AsyncSession = Depends(get_session)
):
    server = await session.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    res = await test_ssh_connection(
        host=server.hostname,
        port=server.port,
        username=server.username,
        password=server.password,
        key_path=server.ssh_key
    )
    return ServerTestConnectionResponse(**res)


@router.post("/deployments/preflight-check", response_model=PreflightCheckResponse)
async def run_deployment_preflight_check(
    payload: PreflightCheckRequest,
    current_user: User = Depends(require_role(UserRole.OPERATOR)),
    session: AsyncSession = Depends(get_session)
):
    details = []
    # 1. Check project
    project = await session.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if current_user.role != UserRole.ADMIN:
        accessible_projects = await get_user_accessible_projects(current_user, session)
        if project.name not in accessible_projects:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You do not have permissions for project '{project.name}'."
            )

    # 2. Check environment & component flow
    env = await session.get(Environment, payload.environment_id)
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")

    stmt_pd = select(ProjectDeployment).where(
        ProjectDeployment.project_id == project.id,
        ProjectDeployment.environment_id == env.id
    )
    if payload.component:
        stmt_pd = stmt_pd.where(ProjectDeployment.component == payload.component)
    res_pd = await session.execute(stmt_pd)
    pd = res_pd.scalars().first()

    # 3. Resolve target server node (from flow server_id, environment_id, or active fleet)
    server = None
    if pd and pd.server_id:
        server = await session.get(Server, pd.server_id)

    if not server:
        stmt_server = select(Server).where(Server.environment_id == env.id)
        res_server = await session.execute(stmt_server)
        server = res_server.scalars().first()

    if not server:
        # Fallback to any server in fleet
        res_any = await session.execute(select(Server))
        server = res_any.scalars().first()

    if not server:
        return PreflightCheckResponse(
            success=False,
            server_reachable=False,
            server_name=None,
            server_host=None,
            auth_method=None,
            details=[f"No server node is registered in Fleet for project '{project.name}' / environment '{env.name.upper()}'."]
        )

    details.append(f"Mapped server node '{server.name}' ({server.username}@{server.hostname}:{server.port}, auth: {server.authentication_method}).")

    # 4. Test SSH connection
    ssh_test = await test_ssh_connection(
        host=server.hostname,
        port=server.port,
        username=server.username,
        password=server.password,
        key_path=server.ssh_key,
        timeout=6
    )

    server_reachable = ssh_test["success"]
    if not server_reachable:
        details.append(f"SSH reachability warning: {ssh_test['message']}")
    else:
        details.append(f"SSH handshake successful ({ssh_test.get('latency_ms', 0)}ms latency).")

    health_status = None
    if pd:
        details.append(f"Flow verified for component '{pd.component}'. Script: '{pd.deployment_script or './deploy.sh'}'.")
        if pd.health_check_url:
            health_status = f"Configured ({pd.health_check_url})"
            details.append(f"Health verification endpoint: {pd.health_check_url}")
    else:
        details.append(f"Note: No component deployment flow defined yet for {project.name} on {env.name}.")

    return PreflightCheckResponse(
        success=server_reachable,
        server_reachable=server_reachable,
        server_name=server.name,
        server_host=server.hostname,
        auth_method=server.authentication_method,
        repo_directory_exists=True if pd else None,
        health_check_status=health_status,
        details=details
    )


@router.delete("/servers/{server_id}")
async def delete_server(
    server_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    s = await session.get(Server, server_id)
    if not s:
        raise HTTPException(status_code=404, detail="Server not found")


    await log_audit_event(
        session, current_user, "delete_server", "server", str(s.id),
        {"name": s.name, "hostname": s.hostname}, request.client.host if request.client else None
    )

    await session.delete(s)
    await session.commit()
    return {"status": "deleted", "server_id": server_id}


@router.get("/stats", response_model=StatsOut)
async def get_system_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    total_tasks = (await session.execute(select(func.count(Task.id)))).scalar() or 0
    running_tasks = (await session.execute(select(func.count(Task.id)).where(Task.status == "RUNNING"))).scalar() or 0
    successful_tasks = (await session.execute(select(func.count(Task.id)).where(Task.status == "SUCCESS"))).scalar() or 0
    failed_tasks = (await session.execute(select(func.count(Task.id)).where(Task.status == "FAILED"))).scalar() or 0

    total_servers = (await session.execute(select(func.count(Server.id)))).scalar() or 0
    total_projects = (await session.execute(select(func.count(Project.id)))).scalar() or 0
    total_environments = (await session.execute(select(func.count(Environment.id)))).scalar() or 0

    return StatsOut(
        total_tasks=total_tasks,
        running_tasks=running_tasks,
        successful_tasks=successful_tasks,
        failed_tasks=failed_tasks,
        total_servers=total_servers,
        total_projects=total_projects,
        total_environments=total_environments,
    )


# =========================================================
# Phase 6: Scheduled Tasks & Cron APIs
# =========================================================

@router.get("/schedules", response_model=List[ScheduledTaskOut])
async def list_schedules(
    current_user: User = Depends(require_role(UserRole.OPERATOR)),
    session: AsyncSession = Depends(get_session)
):
    stmt = select(ScheduledTask).order_by(ScheduledTask.created_at.desc())
    res = await session.execute(stmt)
    return res.scalars().all()


@router.post("/schedules", response_model=ScheduledTaskOut)
async def create_schedule(
    payload: ScheduledTaskCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.OPERATOR)),
    session: AsyncSession = Depends(get_session)
):
    st = ScheduledTask(
        user_id=current_user.id,
        name=payload.name,
        cron_expression=payload.cron_expression,
        user_request=payload.user_request,
        is_active=payload.is_active
    )
    session.add(st)
    await session.commit()
    await session.refresh(st)

    await log_audit_event(
        session, current_user, "create_schedule", "scheduled_task", str(st.id),
        {"name": st.name, "cron": st.cron_expression, "request": st.user_request},
        request.client.host if request.client else None
    )
    return st


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.OPERATOR)),
    session: AsyncSession = Depends(get_session)
):
    st = await session.get(ScheduledTask, schedule_id)
    if not st:
        raise HTTPException(status_code=404, detail="Schedule not found")

    await log_audit_event(
        session, current_user, "delete_schedule", "scheduled_task", str(schedule_id),
        {"name": st.name}, request.client.host if request.client else None
    )
    await session.delete(st)
    await session.commit()
    return {"status": "deleted", "schedule_id": schedule_id}


@router.post("/schedules/{schedule_id}/toggle")
async def toggle_schedule(
    schedule_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.OPERATOR)),
    session: AsyncSession = Depends(get_session)
):
    st = await session.get(ScheduledTask, schedule_id)
    if not st:
        raise HTTPException(status_code=404, detail="Schedule not found")

    st.is_active = not st.is_active
    await session.commit()
    await session.refresh(st)

    await log_audit_event(
        session, current_user, "toggle_schedule", "scheduled_task", str(schedule_id),
        {"name": st.name, "is_active": st.is_active}, request.client.host if request.client else None
    )
    return {"status": "updated", "is_active": st.is_active}


# =========================================================
# Phase 6: Outbound Webhooks & Notifications APIs
# =========================================================

@router.get("/webhooks", response_model=List[WebhookSubscriptionOut])
async def list_webhooks(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    stmt = select(WebhookSubscription).order_by(WebhookSubscription.created_at.desc())
    res = await session.execute(stmt)
    return res.scalars().all()


@router.post("/webhooks", response_model=WebhookSubscriptionOut)
async def create_webhook(
    payload: WebhookSubscriptionCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    wh = WebhookSubscription(
        name=payload.name,
        url=payload.url,
        secret=payload.secret,
        event_types=payload.event_types or ["task.failed", "task.success", "task.awaiting_confirmation", "task.rolled_back"]
    )
    session.add(wh)
    await session.commit()
    await session.refresh(wh)

    await log_audit_event(
        session, current_user, "create_webhook", "webhook", str(wh.id),
        {"name": wh.name, "url": wh.url}, request.client.host if request.client else None
    )
    return wh


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    wh = await session.get(WebhookSubscription, webhook_id)
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")

    await log_audit_event(
        session, current_user, "delete_webhook", "webhook", str(webhook_id),
        {"name": wh.name}, request.client.host if request.client else None
    )
    await session.delete(wh)
    await session.commit()
    return {"status": "deleted", "webhook_id": webhook_id}


@router.post("/webhooks/test")
async def test_webhook_endpoint(
    payload: WebhookTestRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    res = await webhook_dispatcher.test_webhook(payload.url, payload.secret)
    return res


# =========================================================
# Phase 6: DevOps Policies & Compliance Guardrails APIs
# =========================================================

@router.get("/policies", response_model=List[PolicyRuleOut])
async def list_policies(
    current_user: User = Depends(require_role(UserRole.OPERATOR)),
    session: AsyncSession = Depends(get_session)
):
    stmt = select(PolicyRule).order_by(PolicyRule.created_at.desc())
    res = await session.execute(stmt)
    return res.scalars().all()


@router.post("/policies", response_model=PolicyRuleOut)
async def create_policy(
    payload: PolicyRuleCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    p = PolicyRule(
        name=payload.name,
        environment=payload.environment,
        block_weekends=payload.block_weekends,
        allowed_hours_start=payload.allowed_hours_start,
        allowed_hours_end=payload.allowed_hours_end,
        require_double_confirm=payload.require_double_confirm,
        is_active=payload.is_active
    )
    session.add(p)
    await session.commit()
    await session.refresh(p)

    await log_audit_event(
        session, current_user, "create_policy", "policy_rule", str(p.id),
        {"name": p.name, "env": p.environment}, request.client.host if request.client else None
    )
    return p


@router.delete("/policies/{policy_id}")
async def delete_policy(
    policy_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    p = await session.get(PolicyRule, policy_id)
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")

    await log_audit_event(
        session, current_user, "delete_policy", "policy_rule", str(policy_id),
        {"name": p.name}, request.client.host if request.client else None
    )
    await session.delete(p)
    await session.commit()
    return {"status": "deleted", "policy_id": policy_id}


# =========================================================
# Phase 6: Multi-LLM Provider APIs
# =========================================================

@router.get("/system/llm", response_model=LLMProviderOut)
async def get_llm_status(
    current_user: User = Depends(get_current_user)
):
    return LLMProviderOut(**multi_llm.get_status())


@router.post("/system/llm")
async def set_llm_provider(
    payload: LLMProviderConfig,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session)
):
    multi_llm.set_provider(
        provider=payload.provider,
        model=payload.model_name,
        api_key=payload.api_key
    )
    await log_audit_event(
        session, current_user, "configure_llm", "system", "llm",
        {"provider": payload.provider, "model": payload.model_name},
        request.client.host if request.client else None
    )
    return {"status": "configured", "provider": payload.provider, "model": payload.model_name}

