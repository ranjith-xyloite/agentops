import asyncio
from typing import Dict, Any
from datetime import datetime, timezone
from sqlalchemy import select, func
from app.database.session import AsyncSessionLocal
from app.models.models import Project, ProjectDeployment, TaskExecution, Server, Environment
from app.core.ssh import get_ssh_executor
from app.services.task_service import task_broadcaster


async def deploy_frontend(task_id: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Deploy frontend component to target environment using SSH."""
    async with AsyncSessionLocal() as session:
        project_name = parameters.get("project", "mom")
        component = parameters.get("component", "frontend")
        environment_name = parameters.get("environment", "uat")
        branch = parameters.get("branch", "main")

        # Find matching deployment
        stmt = (
            select(ProjectDeployment)
            .join(Project, Project.id == ProjectDeployment.project_id)
            .join(Environment, Environment.id == ProjectDeployment.environment_id)
            .where(func.lower(ProjectDeployment.component) == component.lower())
            .where(func.lower(Environment.name) == environment_name.lower())
        )
        if project_name:
            stmt = stmt.where(func.lower(Project.name).contains(project_name.lower()) | (func.lower(Project.name) == project_name.lower()))
        res = await session.execute(stmt)
        pd = res.scalars().first()

        if not pd and project_name in ("mom", "default"):
            # Fallback to any deployment matching component for baseline demo
            stmt_fb = select(ProjectDeployment).where(func.lower(ProjectDeployment.component) == component.lower())
            res_fb = await session.execute(stmt_fb)
            pd = res_fb.scalars().first()

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
            await emit(f"🚀 Initializing deployment for component '{component}' on '{environment_name}'...")

            if not pd:
                err_msg = f"No deployment configuration found for project '{project_name}', component '{component}'"
                await emit(f"❌ {err_msg}")
                final_status = "FAILED"
            else:
                # Resolve target server (via pd.server_id, pd.environment_id, or active fleet)
                server = None
                if pd and pd.server_id:
                    server = await session.get(Server, pd.server_id)

                if not server and pd:
                    stmt_server = select(Server).where(Server.environment_id == pd.environment_id)
                    res_server = await session.execute(stmt_server)
                    server = res_server.scalars().first()

                if not server:
                    stmt_env = select(Server).join(Environment, Environment.id == Server.environment_id).where(
                        func.lower(Environment.name) == environment_name.lower()
                    )
                    res_env = await session.execute(stmt_env)
                    server = res_env.scalars().first()

                if not server:
                    # Fallback to any active server node in fleet
                    res_any = await session.execute(select(Server))
                    server = res_any.scalars().first()

                if not server:
                    err_msg = f"No active server node available in Fleet for deployment"
                    await emit(f"❌ {err_msg}")
                    final_status = "FAILED"
                else:
                    from app.core.ssh import register_server_in_pool
                    register_server_in_pool(server)
                    executor = get_ssh_executor()
                    host_key = f"server:{server.id}"

                    await emit(f"📡 Connecting to server: {server.name} ({server.hostname}:{server.port}) as {server.username}...")

                    repo_path = pd.repository_path if pd and pd.repository_path else f"/opt/{project_name}/{component}"
                    await emit(f"📂 Navigating to target directory: {repo_path}")

                    # Check if path exists or create if needed
                    chk_dir = await executor.execute(host_key, f"mkdir -p {repo_path} && cd {repo_path}", timeout=30)
                    git_timeout = int(os.getenv("GIT_TIMEOUT", "1800"))
                    deploy_timeout = int(os.getenv("DEPLOYMENT_TIMEOUT", "1800"))

                    # Check if it's a Git repo
                    git_check = await executor.execute(host_key, f"cd {repo_path} && git rev-parse --is-inside-work-tree", timeout=15)
                    if git_check.exit_code == 0:
                        await emit(f"⚡ Git repository detected. Fetching latest changes on branch '{branch}'...")
                        cmd_git = f"cd {repo_path} && git fetch origin && git checkout {branch} && git pull origin {branch}"
                        git_res = await executor.execute(host_key, cmd_git, timeout=git_timeout)
                        if git_res.exit_code != 0:
                            await emit(f"⚠️ Git pull notice: {git_res.stderr or git_res.stdout}")
                        else:
                            await emit(f"✅ Successfully checked out and synced branch '{branch}'.")
                    else:
                        await emit(f"ℹ️ Directory '{repo_path}' is not a Git repo. Proceeding directly with deployment script...")

                    # Execute deployment script / command
                    deploy_script = (pd.deployment_script if pd and pd.deployment_script else "./deploy.sh").strip()
                    await emit(f"🔨 Executing deployment command / script: {deploy_script}...")

                    if deploy_script.startswith(("./", "/", "bash ", "sh ", "docker ", "docker-compose ", "npm ", "node ", "python ", "python3 ", "sudo ")):
                        exec_cmd = deploy_script
                    elif deploy_script.endswith(".sh"):
                        exec_cmd = f"bash {deploy_script}"
                    else:
                        exec_cmd = f"chmod +x ./{deploy_script} 2>/dev/null; ./{deploy_script} 2>/dev/null || bash {deploy_script} 2>/dev/null || {deploy_script}"

                    cmd_deploy = f"cd {repo_path} && {exec_cmd}"

                    deploy_res = await executor.execute(host_key, cmd_deploy, timeout=deploy_timeout)

                    if deploy_res.stdout:
                        for line in deploy_res.stdout.strip().split("\n"):
                            if line.strip():
                                await emit(f"  {line}")
                    if deploy_res.stderr:
                        for line in deploy_res.stderr.strip().split("\n"):
                            if line.strip():
                                await emit(f"  [stderr] {line}")

                    if deploy_res.exit_code != 0:
                        err_msg = f"Deployment script exited with non-zero code ({deploy_res.exit_code})"
                        await emit(f"❌ {err_msg}")
                        final_status = "FAILED"
                    else:
                        await emit("✅ Script execution completed successfully.")

                        # Post-deploy health check
                        health_url = pd.health_check_url if pd else None
                        if health_url:
                            await emit(f"🩺 Verifying health endpoint: {health_url}...")
                            await asyncio.sleep(0.5)
                            cmd_health = f"curl -s -o /dev/null -w '%{{http_code}}' --max-time 15 {health_url}"
                            health_res = await executor.execute(host_key, cmd_health, timeout=20)

                            http_code = health_res.stdout.strip()
                            if health_res.exit_code == 0 and http_code in ("200", "301", "302"):
                                await emit(f"✅ Health check PASSED (HTTP {http_code})")
                            else:
                                err_msg = f"Health check returned status HTTP {http_code or 'unreachable'}"
                                await emit(f"❌ {err_msg}")
                                final_status = "FAILED"
                        else:
                            await emit("ℹ️ No health check URL specified, skipping probe.")

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
