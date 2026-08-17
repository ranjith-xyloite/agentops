import asyncio
from typing import Dict, Any
from datetime import datetime, timezone
from sqlalchemy import select
from app.database.session import AsyncSessionLocal
from app.models.models import ProjectDeployment, TaskExecution, Server
from app.core.ssh import get_ssh_executor
from app.services.task_service import task_broadcaster


async def deploy_frontend(task_id: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Deploy frontend component to target environment using SSH."""
    async with AsyncSessionLocal() as session:
        project = parameters.get("project", "mom")
        component = parameters.get("component", "frontend")
        environment = parameters.get("environment", "uat")
        branch = parameters.get("branch", "main")

        # Find matching deployment
        stmt = select(ProjectDeployment).where(
            ProjectDeployment.component == component
        )
        res = await session.execute(stmt)
        pd = res.scalars().first()

        # Create TaskExecution row
        te = TaskExecution(
            task_id=task_id,
            tool_name="deploy_frontend",
            parameters=parameters,
            status="RUNNING",
            started_at=datetime.now(timezone.utc)
        )
        session.add(te)
        await session.flush()
        exec_id = te.id
        await session.commit()

        logs = []
        final_status = "SUCCESS"

        async def emit(msg: str):
            logs.append(msg)
            await task_broadcaster.broadcast(task_id, {
                "task_id": task_id,
                "execution_id": exec_id,
                "log": msg,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

        try:
            await emit(f"🚀 Starting frontend deployment for project '{project}' (branch: {branch})...")

            if not pd:
                err_msg = f"No deployment configuration found for {project}/{component}"
                await emit(f"❌ {err_msg}")
                final_status = "FAILED"
            else:
                # Get target server for the environment
                stmt_server = select(Server).where(Server.environment_id == pd.environment_id)
                res_server = await session.execute(stmt_server)
                server = res_server.scalars().first()

                if not server:
                    err_msg = "No target server configured for the selected environment"
                    await emit(f"❌ {err_msg}")
                    final_status = "FAILED"
                else:
                    executor = get_ssh_executor()
                    host_key = f"{server.environment_id}:{server.name}"

                    await emit(f"📡 Connecting to server {server.name} ({server.hostname}:{server.port})...")

                    repo_path = pd.repository_path or "/opt/app/frontend"
                    await emit(f"📂 Navigating to repository directory: {repo_path}")

                    # Git fetch and checkout
                    cmd_git = f"cd {repo_path} && git fetch origin && git checkout {branch} && git pull origin {branch}"
                    await emit(f"⚡ Fetching latest changes on branch '{branch}'...")
                    git_res = await executor.execute(host_key, cmd_git, timeout=120)

                    if git_res.exit_code != 0:
                        err_msg = f"Git checkout/pull failed (code {git_res.exit_code}): {git_res.stderr or git_res.stdout}"
                        await emit(f"❌ {err_msg}")
                        final_status = "FAILED"
                    else:
                        await emit(f"✅ Successfully checked out and synced branch '{branch}'.")

                        # Execute deployment script
                        deploy_script = pd.deployment_script or "./deploy_frontend.sh"
                        await emit(f"🔨 Running build and deployment script: {deploy_script}...")
                        cmd_deploy = f"cd {repo_path} && chmod +x {deploy_script} && {deploy_script}"
                        deploy_res = await executor.execute(host_key, cmd_deploy, timeout=300)

                        if deploy_res.exit_code != 0:
                            err_msg = f"Deployment script failed (code {deploy_res.exit_code}): {deploy_res.stderr or deploy_res.stdout}"
                            await emit(f"❌ {err_msg}")
                            final_status = "FAILED"
                        else:
                            await emit("✅ Frontend build completed successfully.")

                            # Post-deploy health check
                            health_url = pd.health_check_url
                            if health_url:
                                await emit(f"🩺 Verifying health endpoint: {health_url}...")
                                await asyncio.sleep(0.1)
                                cmd_health = f"curl -s -o /dev/null -w '%{{http_code}}' --max-time 15 {health_url}"
                                health_res = await executor.execute(host_key, cmd_health, timeout=20)

                                http_code = health_res.stdout.strip()
                                if health_res.exit_code == 0 and http_code in ("200", "301", "302"):
                                    await emit(f"✅ Health check PASSED (HTTP {http_code})")
                                else:
                                    err_msg = f"Health check returned unexpected status HTTP {http_code}"
                                    await emit(f"❌ {err_msg}")
                                    final_status = "FAILED"
                            else:
                                await emit("ℹ️ No health check URL specified, skipping verification.")

                            if final_status == "SUCCESS":
                                await emit("🎉 Frontend deployment completed successfully!")

        except Exception as e:
            final_status = "FAILED"
            await emit(f"❌ Unexpected exception during deployment: {str(e)}")

        out_text = "\n".join(logs)
        # Update TaskExecution record
        async with AsyncSessionLocal() as update_session:
            t_exec = await update_session.get(TaskExecution, exec_id)
            if t_exec:
                t_exec.status = final_status
                t_exec.output = out_text
                t_exec.completed_at = datetime.now(timezone.utc)
                await update_session.commit()

        return {"status": final_status, "output": out_text}
