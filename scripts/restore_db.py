"""
AgentOps Database Restoration Utility
Restores database tables from a verified backup snapshot.
"""
import os
import sys
import json
import asyncio
import hashlib
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from sqlalchemy import delete
from app.database.session import AsyncSessionLocal, engine
from app.models.models import (
    Base, Project, Environment, Server, ProjectDeployment,
    User, UserRole, Task
)


async def run_restore(backup_file_path: str):
    path = Path(backup_file_path)
    if not path.exists():
        print(f"[!] Error: Backup file '{backup_file_path}' does not exist.")
        sys.exit(1)

    # Verify checksum if .sha256 companion file exists
    checksum_file = path.with_suffix('.sha256')
    raw_content = path.read_text(encoding="utf-8")
    if checksum_file.exists():
        expected_sha = checksum_file.read_text(encoding="utf-8").strip()
        actual_sha = hashlib.sha256(raw_content.encode("utf-8")).hexdigest()
        if expected_sha != actual_sha:
            print(f"[!] Error: Checksum mismatch! Corrupted backup file.")
            sys.exit(1)
        print(f"[*] Checksum verified: {actual_sha}")

    data = json.loads(raw_content)
    print(f"[*] Restoring AgentOps database from {path.name} (Version: {data.get('metadata', {}).get('version')})...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Restore projects
        for p in data["tables"].get("projects", []):
            proj = await session.get(Project, p["id"])
            if not proj:
                session.add(Project(id=p["id"], name=p["name"], description=p.get("description"), repository_url=p.get("repository_url")))

        # Restore environments
        for e in data["tables"].get("environments", []):
            env = await session.get(Environment, e["id"])
            if not env:
                session.add(Environment(id=e["id"], name=e["name"], description=e.get("description")))

        # Restore servers
        for s in data["tables"].get("servers", []):
            srv = await session.get(Server, s["id"])
            if not srv:
                session.add(Server(
                    id=s["id"], name=s["name"], hostname=s["hostname"], port=s["port"],
                    username=s["username"], environment_id=s["environment_id"],
                    authentication_method=s.get("authentication_method", "ssh_key")
                ))

        # Restore users
        for u in data["tables"].get("users", []):
            user = await session.get(User, u["id"])
            if not user:
                session.add(User(
                    id=u["id"], username=u["username"], email=u["email"],
                    hashed_password=u["hashed_password"], role=UserRole(u["role"]),
                    is_active=u.get("is_active", True)
                ))

        await session.commit()

    print(f"[+] Database restoration complete!")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python restore_db.py <path_to_backup.json>")
        sys.exit(1)
    asyncio.run(run_restore(sys.argv[1]))
