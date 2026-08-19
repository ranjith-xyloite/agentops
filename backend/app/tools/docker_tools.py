"""
Docker and backend management tools for AgentOps.
"""
import os
import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy import select, func
from app.core.ssh import get_ssh_executor, register_server_in_pool
from app.database.session import AsyncSessionLocal
from app.models.models import Server, ProjectDeployment, TaskExecution, Environment
from app.services.task_service import task_broadcaster


async def _resolve_target_servers(db_session, parameters: Dict[str, Any]) -> List[Server]:
    """
    Intelligently resolve target servers by server_id, server name, or environment,
    with graceful fallbacks.
    """
    server_id = parameters.get("server_id")
    server_name = parameters.get("server") or parameters.get("server_name")
    environment = parameters.get("environment")

    if server_id:
        try:
            stmt = select(Server).where(Server.id == int(server_id))
            res = await db_session.execute(stmt)
            servers = res.scalars().all()
            if servers:
                return servers
        except (ValueError, TypeError):
            pass

    if server_name:
        clean_name = str(server_name).strip()
        # 1. Exact match
        stmt = select(Server).where(func.lower(Server.name) == clean_name.lower())
        res = await db_session.execute(stmt)
        servers = res.scalars().all()
        if servers:
            return servers

        # 2. Substring / contains match (e.g. "physical" matches "Xy-physical-server")
        stmt_like = select(Server).where(Server.name.ilike(f"%{clean_name}%"))
        res_like = await db_session.execute(stmt_like)
        servers = res_like.scalars().all()
        if servers:
            return servers

        # 3. Hostname / IP match
        stmt_host = select(Server).where(Server.hostname.ilike(f"%{clean_name}%"))
        res_host = await db_session.execute(stmt_host)
        servers = res_host.scalars().all()
        if servers:
            return servers

    if environment:
        # First, try matching environment table name
        stmt = select(Server).join(Server.environment).where(
            func.lower(Environment.name) == str(environment).lower().strip()
        )
        res = await db_session.execute(stmt)
        servers = res.scalars().all()
        if servers:
            return servers

        # Fallback 1: check if 'environment' string matches a server's name directly (e.g. user said "health check on KC-server")
        stmt_fallback = select(Server).where(func.lower(Server.name) == str(environment).lower().strip())
        res_fallback = await db_session.execute(stmt_fallback)
        servers = res_fallback.scalars().all()
        if servers:
            return servers

    # Fallback 2: If nothing found or no params, query all available servers
    res_all = await db_session.execute(select(Server))
    return res_all.scalars().all()


async def docker_status(task_id: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get Docker container status on target environment servers.
    
    Parameters:
        environment: Target environment (uat, qa, production)
        server: Target server name
        project: Optional project name to filter containers
        component: Optional component to filter (frontend, backend)
    """
    async with AsyncSessionLocal() as session:
        te = TaskExecution(
            task_id=task_id,
            tool_name="docker_status",
            parameters=parameters,
            status="RUNNING",
            started_at=datetime.now(timezone.utc)
        )
        session.add(te)
        await session.flush()
        await session.commit()
        
        logs = []
        async def emit(msg: str):
            logs.append(msg)
            te.output = "\n".join(logs)
            await session.commit()
            await task_broadcaster.broadcast(task_id, {
                "task_id": task_id,
                "execution_id": te.id,
                "log": msg,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        try:
            environment = parameters.get("environment", "uat")
            server_target = parameters.get("server") or parameters.get("server_name")
            project = parameters.get("project")
            component = parameters.get("component")
            
            target_label = f"server '{server_target}'" if server_target else f"environment '{environment}'"
            await emit(f"🔍 Fetching Docker container status for {target_label}...")
            
            async with AsyncSessionLocal() as db_session:
                servers = await _resolve_target_servers(db_session, parameters)
            
            if not servers:
                err_msg = f"No servers found for {target_label}"
                await emit(f"❌ {err_msg}")
                te.status = "FAILED"
                te.error = err_msg
                await session.commit()
                return {"status": "FAILED", "output": te.output}
            
            executor = get_ssh_executor()
            all_containers = []
            
            for server in servers:
                register_server_in_pool(server)
                host_key = f"server:{server.id}"
                await emit(f"📡 Querying Docker daemon on {server.name} ({server.hostname})...")
                
                cmd = "docker ps --format '{{json .}}'"
                if project or component:
                    filters = []
                    if project:
                        filters.append(f"name={project}")
                    if component:
                        filters.append(f"name={component}")
                    if filters:
                        cmd += " --filter " + " --filter ".join(filters)
                
                result = await executor.execute(host_key, cmd, timeout=30)
                
                if result.exit_code == 0:
                    lines = result.stdout.strip().split('\n')
                    count_server = 0
                    for line in lines:
                        if line.strip():
                            try:
                                container = json.loads(line)
                                container['server'] = server.name
                                container['server_hostname'] = server.hostname
                                all_containers.append(container)
                                count_server += 1
                            except json.JSONDecodeError:
                                pass
                    await emit(f"  ✅ {server.name}: {count_server} container(s) active")
                else:
                    await emit(f"  ⚠️ {server.name} Docker query failed: {result.stderr or result.stdout}")
            
            await emit(f"📊 Total running containers discovered: {len(all_containers)}")
            
            output_data = {
                "containers": all_containers,
                "count": len(all_containers),
                "environment": environment
            }
            
            te.output = json.dumps(output_data, indent=2)
            te.status = "SUCCESS"
            await session.commit()
            return {"status": "SUCCESS", "output": te.output}
            
        except Exception as e:
            te.status = "FAILED"
            te.error = str(e)
            await emit(f"❌ Error during Docker status query: {str(e)}")
            await session.commit()
            return {"status": "FAILED", "output": str(e)}
        finally:
            te.completed_at = datetime.now(timezone.utc)
            await session.commit()


async def restart_container(task_id: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """
    Restart a Docker container on target environment servers.
    
    Parameters:
        environment: Target environment (uat, qa, production)
        project: Project name (optional if container_name provided)
        component: Component name (optional if container_name provided)
        container_name: Specific container name
    """
    async with AsyncSessionLocal() as session:
        te = TaskExecution(
            task_id=task_id,
            tool_name="restart_container",
            parameters=parameters,
            status="RUNNING",
            started_at=datetime.now(timezone.utc)
        )
        session.add(te)
        await session.flush()
        await session.commit()
        
        logs = []
        async def emit(msg: str):
            logs.append(msg)
            te.output = "\n".join(logs)
            await session.commit()
            await task_broadcaster.broadcast(task_id, {
                "task_id": task_id,
                "execution_id": te.id,
                "log": msg,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        try:
            environment = parameters.get("environment", "uat")
            project = parameters.get("project")
            component = parameters.get("component")
            container_name = parameters.get("container_name")
            
            target = container_name or (f"{project}-{component}" if project and component else project)
            if not target:
                err_msg = "Either container_name or project/component required"
                await emit(f"❌ {err_msg}")
                te.status = "FAILED"
                te.error = err_msg
                await session.commit()
                return {"status": "FAILED", "output": te.output}
            
            server_target = parameters.get("server") or parameters.get("server_name")
            target_label = f"server '{server_target}'" if server_target else f"environment '{environment}'"
            await emit(f"🔄 Restarting container '{target}' on {target_label}...")
            
            async with AsyncSessionLocal() as db_session:
                servers = await _resolve_target_servers(db_session, parameters)
            
            if not servers:
                err_msg = f"No servers found for {target_label}"
                await emit(f"❌ {err_msg}")
                te.status = "FAILED"
                te.error = err_msg
                await session.commit()
                return {"status": "FAILED", "output": te.output}
            
            executor = get_ssh_executor()
            success_count = 0
            
            for server in servers:
                register_server_in_pool(server)
                host_key = f"server:{server.id}"
                await emit(f"📡 Executing restart on {server.name} ({server.hostname})...")
                
                cmd = f"docker restart {target}"
                result = await executor.execute(host_key, cmd, timeout=60)
                
                if result.exit_code == 0:
                    await emit(f"  ✅ Container '{target}' restarted successfully on {server.name}")
                    success_count += 1
                    
                    # Verify health status
                    health_cmd = f"docker inspect --format='{{{{json .State.Status}}}}' {target}"
                    health_res = await executor.execute(host_key, health_cmd, timeout=10)
                    if health_res.exit_code == 0:
                        await emit(f"  🩺 Container status: {health_res.stdout.strip()}")
                else:
                    await emit(f"  ❌ Restart failed on {server.name}: {result.stderr or result.stdout}")
            
            if success_count > 0:
                te.status = "SUCCESS"
                await emit(f"🎉 Restart completed on {success_count}/{len(servers)} node(s).")
            else:
                te.status = "FAILED"
                te.error = f"Failed to restart '{target}' on any server."
            
            await session.commit()
            return {"status": te.status, "output": te.output}
            
        except Exception as e:
            te.status = "FAILED"
            te.error = str(e)
            await emit(f"❌ Exception during container restart: {str(e)}")
            await session.commit()
            return {"status": "FAILED", "output": str(e)}
        finally:
            te.completed_at = datetime.now(timezone.utc)
            await session.commit()


async def server_health_check(task_id: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform comprehensive health checks on environment or specific servers.
    
    Parameters:
        environment: Target environment (uat, qa, production)
        server: Target server name
        checks: List of checks (http, tcp, disk, memory, cpu)
        url: URL for HTTP check
        port: Port for TCP check
    """
    async with AsyncSessionLocal() as session:
        te = TaskExecution(
            task_id=task_id,
            tool_name="server_health_check",
            parameters=parameters,
            status="RUNNING",
            started_at=datetime.now(timezone.utc)
        )
        session.add(te)
        await session.flush()
        await session.commit()
        
        logs = []
        async def emit(msg: str):
            logs.append(msg)
            te.output = "\n".join(logs)
            await session.commit()
            await task_broadcaster.broadcast(task_id, {
                "task_id": task_id,
                "execution_id": te.id,
                "log": msg,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        try:
            environment = parameters.get("environment")
            server_target = parameters.get("server") or parameters.get("server_name")
            checks = parameters.get("checks", ["http", "tcp", "disk", "memory", "cpu"])
            url = parameters.get("url")
            port = parameters.get("port", 80)
            
            target_label = f"server '{server_target}'" if server_target else (f"environment '{environment}'" if environment else "available fleet servers")
            await emit(f"🩺 Starting server health audit for {target_label}...")
            
            async with AsyncSessionLocal() as db_session:
                servers = await _resolve_target_servers(db_session, parameters)
            
            if not servers:
                err_msg = f"No servers found for {target_label}"
                await emit(f"❌ {err_msg}")
                te.status = "FAILED"
                te.error = err_msg
                await session.commit()
                return {"status": "FAILED", "output": te.output}
            
            executor = get_ssh_executor()
            all_results = []
            
            for server in servers:
                try:
                    register_server_in_pool(server)
                    host_key = f"server:{server.id}"
                    server_results = {"server": server.name, "hostname": server.hostname, "checks": {}}
                    await emit(f"📡 Auditing {server.name} ({server.hostname})...")
                    
                    # HTTP check
                    if "http" in checks and url:
                        cmd_http = f"curl -s -o /dev/null -w '%{{http_code}}' --max-time 10 {url}"
                        res_http = await executor.execute(host_key, cmd_http, timeout=15)
                        http_code = res_http.stdout.strip()
                        passed = (res_http.exit_code == 0 and http_code in ("200", "301", "302"))
                        server_results["checks"]["http"] = {
                            "status": "pass" if passed else "fail",
                            "details": f"HTTP {http_code}" if http_code else res_http.stderr.strip()
                        }
                        await emit(f"  HTTP [{url}]: {'✅' if passed else '❌'} ({server_results['checks']['http']['details']})")
                    
                    # TCP Port check
                    if "tcp" in checks:
                        cmd_tcp = f"timeout 5 bash -c 'cat < /dev/null > /dev/tcp/localhost/{port}'"
                        res_tcp = await executor.execute(host_key, cmd_tcp, timeout=10)
                        passed = (res_tcp.exit_code == 0)
                        server_results["checks"]["tcp"] = {
                            "status": "pass" if passed else "fail",
                            "details": f"Port {port} {'open' if passed else 'closed'}"
                        }
                        await emit(f"  TCP [:{port}]: {'✅' if passed else '❌'} ({server_results['checks']['tcp']['details']})")
                    
                    # Disk Check
                    if "disk" in checks:
                        cmd_disk = "df -h / | tail -1 | awk '{print $5}' | sed 's/%//'"
                        res_disk = await executor.execute(host_key, cmd_disk, timeout=10)
                        if res_disk.exit_code == 0:
                            try:
                                usage = int(res_disk.stdout.strip())
                                d_status = "pass" if usage < 85 else ("warn" if usage < 95 else "fail")
                                server_results["checks"]["disk"] = {"status": d_status, "details": f"{usage}% used"}
                                await emit(f"  Disk usage: {'✅' if d_status == 'pass' else '⚠️'} ({usage}% used)")
                            except ValueError:
                                server_results["checks"]["disk"] = {"status": "fail", "details": "Parse error"}
                        else:
                            server_results["checks"]["disk"] = {"status": "fail", "details": res_disk.stderr}
                    
                    # Memory Check
                    if "memory" in checks:
                        cmd_mem = "free | grep Mem | awk '{print int($3/$2 * 100)}'"
                        res_mem = await executor.execute(host_key, cmd_mem, timeout=10)
                        if res_mem.exit_code == 0:
                            try:
                                usage = int(res_mem.stdout.strip())
                                m_status = "pass" if usage < 85 else ("warn" if usage < 95 else "fail")
                                server_results["checks"]["memory"] = {"status": m_status, "details": f"{usage}% used"}
                                await emit(f"  Memory usage: {'✅' if m_status == 'pass' else '⚠️'} ({usage}% used)")
                            except ValueError:
                                server_results["checks"]["memory"] = {"status": "fail", "details": "Parse error"}
                        else:
                            server_results["checks"]["memory"] = {"status": "fail", "details": res_mem.stderr}
                    
                    # CPU Load Check
                    if "cpu" in checks:
                        cmd_cpu = "uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//'"
                        res_cpu = await executor.execute(host_key, cmd_cpu, timeout=10)
                        if res_cpu.exit_code == 0:
                            try:
                                load = float(res_cpu.stdout.strip())
                                server_results["checks"]["cpu"] = {
                                    "status": "pass" if load < 4.0 else ("warn" if load < 8.0 else "fail"),
                                    "details": f"1m Load: {load}"
                                }
                                await emit(f"  CPU Load (1m): {load}")
                            except ValueError:
                                server_results["checks"]["cpu"] = {"status": "fail", "details": "Parse error"}
                        else:
                            server_results["checks"]["cpu"] = {"status": "fail", "details": res_cpu.stderr}
                    
                    all_results.append(server_results)
                except Exception as server_exc:
                    await emit(f"❌ Exception auditing {server.name}: {str(server_exc)}")
                    server_results = {
                        "server": server.name,
                        "hostname": server.hostname,
                        "checks": {"connection": {"status": "fail", "details": str(server_exc)}}
                    }
                    all_results.append(server_results)
            
            all_passed = all(
                all(c.get("status") in ("pass", "warn") for c in r["checks"].values())
                for r in all_results
            )
            
            # The tool executed successfully even if the actual health is degraded
            te.status = "SUCCESS" 
            health_status = "HEALTHY" if all_passed else "DEGRADED"
            await emit(f"📋 Overall health status: {health_status}")
            te.output = json.dumps({"results": all_results, "health_status": health_status}, indent=2)
            await session.commit()
            return {"status": te.status, "output": te.output}
            
        except Exception as e:
            te.status = "FAILED"
            te.error = str(e)
            await emit(f"❌ Exception during health audit setup: {str(e)}")
            await session.commit()
            return {"status": "FAILED", "output": str(e)}
        finally:
            te.completed_at = datetime.now(timezone.utc)
            await session.commit()


async def deploy_backend(task_id: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deploy backend service to target environment using SSH.
    
    Parameters:
        project: Project name
        component: Should be 'backend'
        environment: Target environment (uat, qa, production)
        branch: Git branch to deploy
    """
    async with AsyncSessionLocal() as session:
        te = TaskExecution(
            task_id=task_id,
            tool_name="deploy_backend",
            parameters=parameters,
            status="RUNNING",
            started_at=datetime.now(timezone.utc)
        )
        session.add(te)
        await session.flush()
        await session.commit()
        
        logs = []
        async def emit(msg: str):
            logs.append(msg)
            te.output = "\n".join(logs)
            await session.commit()
            await task_broadcaster.broadcast(task_id, {
                "task_id": task_id,
                "execution_id": te.id,
                "log": msg,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        try:
            project_name = parameters.get("project", "mom")
            component = parameters.get("component", "backend")
            environment_name = parameters.get("environment", "uat")
            branch = parameters.get("branch", "main")
            
            await emit(f"🚀 Initializing backend deployment for component '{component}' on '{environment_name}'...")
            
            # Find matching deployment config
            async with AsyncSessionLocal() as db_session:
                from app.models.models import Project, Environment
                from sqlalchemy import func
                stmt = (
                    select(ProjectDeployment)
                    .join(Project, Project.id == ProjectDeployment.project_id)
                    .join(Environment, Environment.id == ProjectDeployment.environment_id)
                    .where(func.lower(ProjectDeployment.component) == component.lower())
                    .where(func.lower(Environment.name) == environment_name.lower())
                )
                if project_name:
                    stmt = stmt.where(func.lower(Project.name).contains(project_name.lower()) | (func.lower(Project.name) == project_name.lower()))
                result = await db_session.execute(stmt)
                pd = result.scalars().first()

                if not pd:
                    stmt_fb = select(ProjectDeployment).where(func.lower(ProjectDeployment.component) == component.lower())
                    result_fb = await db_session.execute(stmt_fb)
                    pd = result_fb.scalars().first()
            
            server = None
            async with AsyncSessionLocal() as db_session:
                if pd and pd.server_id:
                    server = await db_session.get(Server, pd.server_id)

                if not server and pd:
                    stmt_server = select(Server).where(Server.environment_id == pd.environment_id)
                    result_server = await db_session.execute(stmt_server)
                    server = result_server.scalars().first()

                if not server:
                    from app.models.models import Environment
                    stmt_env = select(Server).join(Environment, Environment.id == Server.environment_id).where(
                        func.lower(Environment.name) == environment_name.lower()
                    )
                    result_env = await db_session.execute(stmt_env)
                    server = result_env.scalars().first()

                if not server:
                    res_any = await db_session.execute(select(Server))
                    server = res_any.scalars().first()
            
            if not server:
                err_msg = f"No active server node available in Fleet for deployment"
                await emit(f"❌ {err_msg}")
                te.status = "FAILED"
                te.error = err_msg
                await session.commit()
                return {"status": "FAILED", "output": te.output}
            
            from app.core.ssh import register_server_in_pool
            register_server_in_pool(server)
            host_key = f"server:{server.id}"
            executor = get_ssh_executor()
            
            await emit(f"📡 Connecting to server: {server.name} ({server.hostname}:{server.port}) as {server.username}...")
            repo_path = pd.repository_path if pd and pd.repository_path else f"/opt/{project_name}/{component}"
            await emit(f"📂 Navigating to target path: {repo_path}")

            # Check if directory exists or create
            chk_dir = await executor.execute(host_key, f"mkdir -p {repo_path} && cd {repo_path}", timeout=30)
            if chk_dir.exit_code != 0:
                await emit(f"⚠️ Warning accessing directory: {chk_dir.stderr or chk_dir.stdout}")
            
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
            
            # Run deployment script
            deploy_script = (pd.deployment_script if pd and pd.deployment_script else "./deploy.sh").strip()
            await emit(f"🔨 Executing deployment script / command: {deploy_script}...")

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
                err_msg = f"Deployment script failed with exit code ({deploy_res.exit_code})"
                await emit(f"❌ {err_msg}")
                te.status = "FAILED"
                te.error = err_msg
                await session.commit()
                return {"status": "FAILED", "output": te.output}
            
            await emit("✅ Backend build & service restart completed.")
            
            # Health check
            health_url = pd.health_check_url if pd else None
            if health_url:
                await emit(f"🩺 Running post-deploy health check: {health_url}...")
                await asyncio.sleep(1)
                cmd_health = f"curl -s -o /dev/null -w '%{{http_code}}' --max-time 15 {health_url}"
                health_res = await executor.execute(host_key, cmd_health, timeout=20)
                http_code = health_res.stdout.strip()
                if health_res.exit_code == 0 and http_code in ("200", "301", "302"):
                    await emit(f"✅ Health check PASSED (HTTP {http_code})")
                else:
                    err_msg = f"Health check returned code: HTTP {http_code or 'unreachable'}"
                    await emit(f"❌ {err_msg}")
                    te.status = "FAILED"
                    te.error = err_msg
                    await session.commit()
                    return {"status": "FAILED", "output": te.output}
            else:
                await emit("ℹ️ No health check URL configured, skipping.")
            
            te.status = "SUCCESS"
            await emit("🎉 Backend deployment finished successfully!")
            await session.commit()
            return {"status": "SUCCESS", "output": te.output}
            
        except Exception as e:
            te.status = "FAILED"
            te.error = str(e)
            await emit(f"❌ Unexpected exception during backend deployment: {str(e)}")
            await session.commit()
            return {"status": "FAILED", "output": str(e)}
        finally:
            te.completed_at = datetime.now(timezone.utc)
            await session.commit()