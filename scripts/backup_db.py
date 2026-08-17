"""
AgentOps Database Backup Utility
Creates compressed, timestamped JSON/SQL snapshots of the PostgreSQL / SQLite database.
"""
import os
import sys
import json
import asyncio
import hashlib
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from sqlalchemy import select
from app.database.session import AsyncSessionLocal, engine
from app.models.models import (
    Base, Project, Environment, Server, ProjectDeployment,
    User, ProjectMember, APIKey, AuditLog, Task, TaskExecution
)


async def run_backup(output_dir: str = "./backups"):
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = out_path / f"agentops_backup_{timestamp}.json"

    print(f"[*] Starting AgentOps Database Backup...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    data = {
        "metadata": {
            "version": "0.5.0-phase5",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        "tables": {}
    }

    async with AsyncSessionLocal() as session:
        # 1. Projects
        projs = (await session.execute(select(Project))).scalars().all()
        data["tables"]["projects"] = [
            {"id": p.id, "name": p.name, "description": p.description, "repository_url": p.repository_url}
            for p in projs
        ]

        # 2. Environments
        envs = (await session.execute(select(Environment))).scalars().all()
        data["tables"]["environments"] = [
            {"id": e.id, "name": e.name, "description": e.description}
            for e in envs
        ]

        # 3. Servers
        servers = (await session.execute(select(Server))).scalars().all()
        data["tables"]["servers"] = [
            {
                "id": s.id, "name": s.name, "hostname": s.hostname, "port": s.port,
                "username": s.username, "environment_id": s.environment_id,
                "authentication_method": s.authentication_method
            }
            for s in servers
        ]

        # 4. Deployments
        deps = (await session.execute(select(ProjectDeployment))).scalars().all()
        data["tables"]["project_deployments"] = [
            {
                "id": d.id, "project_id": d.project_id, "environment_id": d.environment_id,
                "component": d.component, "repository_path": d.repository_path,
                "deployment_script": d.deployment_script, "health_check_url": d.health_check_url
            }
            for d in deps
        ]

        # 5. Users
        users = (await session.execute(select(User))).scalars().all()
        data["tables"]["users"] = [
            {
                "id": u.id, "username": u.username, "email": u.email,
                "hashed_password": u.hashed_password, "role": u.role.value,
                "is_active": u.is_active
            }
            for u in users
        ]

        # 6. Tasks
        tasks = (await session.execute(select(Task))).scalars().all()
        data["tables"]["tasks"] = [
            {
                "id": t.id, "user_id": t.user_id, "user_request": t.user_request,
                "intent": t.intent, "status": t.status,
                "requires_confirmation": t.requires_confirmation,
                "last_message": t.last_message
            }
            for t in tasks
        ]

    json_str = json.dumps(data, indent=2)
    backup_file.write_text(json_str, encoding="utf-8")
    sha256 = hashlib.sha256(json_str.encode("utf-8")).hexdigest()

    checksum_file = out_path / f"agentops_backup_{timestamp}.sha256"
    checksum_file.write_text(sha256, encoding="utf-8")

    print(f"[+] Backup saved successfully: {backup_file}")
    print(f"[+] Checksum SHA256: {sha256}")
    print(f"[+] Summary: {len(data['tables']['users'])} users, {len(data['tables']['projects'])} projects, {len(data['tables']['servers'])} servers, {len(data['tables']['tasks'])} tasks.")


if __name__ == "__main__":
    asyncio.run(run_backup())
