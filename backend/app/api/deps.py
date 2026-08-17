from typing import Optional, List, Callable
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.session import get_session
from app.models.models import User, UserRole, APIKey, AuditLog, Project, ProjectMember
from app.core.security import decode_token, hash_api_key

security_bearer = HTTPBearer(auto_error=False)

ROLE_HIERARCHY = {
    UserRole.VIEWER: 1,
    UserRole.OPERATOR: 2,
    UserRole.ADMIN: 3,
}


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure datetime is timezone-aware in UTC for safe comparison."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def get_current_user(
    request: Request,
    auth_creds: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_session)
) -> User:
    """
    Authenticate user via Bearer JWT token or X-API-Key header.
    """
    # 1. Try Bearer JWT Token
    if auth_creds and auth_creds.credentials:
        token = auth_creds.credentials
        try:
            payload = decode_token(token)
            if payload.get("type") != "access":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token type",
                    headers={"WWW-Authenticate": "Bearer"}
                )
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
            
            user = await db.get(User, int(user_id))
            if not user or not user.is_active:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or not found")
            return user
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"}
            )

    # 2. Try X-API-Key header
    if x_api_key:
        key_hash = hash_api_key(x_api_key)
        stmt = select(APIKey).where(APIKey.key_hash == key_hash, APIKey.is_active == True)
        res = await db.execute(stmt)
        api_key = res.scalar_one_or_none()

        if not api_key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or inactive API key")

        # Check expiry with safe timezone handling
        if api_key.expires_at and ensure_utc(api_key.expires_at) < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key has expired")

        # Update last used timestamp
        api_key.last_used_at = datetime.now(timezone.utc)
        await db.commit()

        user = await db.get(User, api_key.user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key user inactive or deleted")
        return user

    # No credentials supplied
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated. Provide Bearer token or X-API-Key header.",
        headers={"WWW-Authenticate": "Bearer"}
    )


def require_role(min_role: UserRole) -> Callable:
    """Enforce minimum role requirement based on role hierarchy."""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_level = ROLE_HIERARCHY.get(current_user.role, 0)
        required_level = ROLE_HIERARCHY.get(min_role, 99)
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires '{min_role.value}' role or higher. Your role is '{current_user.role.value}'."
            )
        return current_user
    return role_checker


async def get_user_accessible_projects(user: User, db: AsyncSession) -> List[str]:
    """Retrieve list of project names accessible by user (all for admin, assigned for operator/viewer)."""
    if user.role == UserRole.ADMIN:
        stmt = select(Project.name)
        res = await db.execute(stmt)
        return [row[0] for row in res.all()]

    # Operator / Viewer
    stmt = (
        select(Project.name)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == user.id)
    )
    res = await db.execute(stmt)
    return [row[0] for row in res.all()]


async def verify_project_access(user: User, project_name: Optional[str], db: AsyncSession):
    """Ensure user has permission to view/deploy specified project."""
    if not project_name or user.role == UserRole.ADMIN:
        return

    allowed = await get_user_accessible_projects(user, db)
    if project_name not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You are not assigned to project '{project_name}'."
        )


async def log_audit_event(
    db: AsyncSession,
    user: Optional[User],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None
):
    """Record an audit log entry for security and operational tracking."""
    audit = AuditLog(
        user_id=user.id if user else None,
        username=user.username if user else "system",
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        details=details or {},
        ip_address=ip_address
    )
    db.add(audit)
    await db.commit()
