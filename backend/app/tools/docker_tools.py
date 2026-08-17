"""
Docker and backend management tools for AgentOps.
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy import select
from app.core.ssh import get_ssh_executor
from app.database.session import AsyncSessionLocal
from app.models.models import Server, ProjectDeployment, TaskExecution
from app.services.task_service import task_broadcaster


async def docker_status(task_id: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get Docker container status on target environment servers.
    
    Parameters:
        environment: Target environment (uat, qa, production)
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
            project = parameters.get("project")
            component = parameters.get("component")
            
            await emit(f"🔍 Fetching Docker container status for environment '{environment}'...")
            
            async with AsyncSessionLocal() as db_session:
                stmt = select(Server).join(Server.environment).where(
                    Server.environment.has(name=environment)
                )
                result = await db_session.execute(stmt)
                servers = result.scalars().all()
            
            if not servers:
                err_msg = f"No servers found for environment '{environment}'"
                await emit(f"❌ {err_msg}")
                te.status = "FAILED"
                te.error = err_msg
                await session.commit()
                return {"status": "FAILED", "output": te.output}
            
            executor = get_ssh_executor()
            all_containers = []
            
            for server in servers:
                host_key = f"{server.environment_id}:{server.name}"
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
            
            await emit(f"🔄 Restarting container '{target}' in environment '{environment}'...")
            
            async with AsyncSessionLocal() as db_session:
                stmt = select(Server).join(Server.environment).where(
                    Server.environment.has(name=environment)
                )
                result = await db_session.execute(stmt)
                servers = result.scalars().all()
            
            if not servers:
                err_msg = f"No servers found for environment '{environment}'"
                await emit(f"❌ {err_msg}")
                te.status = "FAILED"
                te.error = err_msg
                await session.commit()
                return {"status": "FAILED", "output": te.output}
            
            executor = get_ssh_executor()
            success_count = 0
            
            for server in servers:
                host_key = f"{server.environment_id}:{server.name}"
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
    Perform comprehensive health checks on environment servers.
    
    Parameters:
        environment: Target environment (uat, qa, production)
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
            environment = parameters.get("environment", "uat")
            checks = parameters.get("checks", ["http", "tcp", "disk", "memory", "cpu"])
            url = parameters.get("url")
            port = parameters.get("port", 80)
            
            await emit(f"🩺 Starting server health audit for environment '{environment}'...")
            
            async with AsyncSessionLocal() as db_session:
                stmt = select(Server).join(Server.environment).where(
                    Server.environment.has(name=environment)
                )
                result = await db_session.execute(stmt)
                servers = result.scalars().all()
            
            if not servers:
                err_msg = f"No servers found for environment '{environment}'"
                await emit(f"❌ {err_msg}")
                te.status = "FAILED"
                te.error = err_msg
                await session.commit()
                return {"status": "FAILED", "output": te.output}
            
            executor = get_ssh_executor()
            all_results = []
            
            for server in servers:
                host_key = f"{server.environment_id}:{server.name}"
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
            
            all_passed = all(
                all(c.get("status") in ("pass", "warn") for c in r["checks"].values())
                for r in all_results
            )
            
            te.status = "SUCCESS" if all_passed else "WARNING"
            await emit(f"📋 Overall health status: {te.status}")
            te.output = json.dumps({"results": all_results}, indent=2)
            await session.commit()
            return {"status": te.status, "output": te.output}
            
        except Exception as e:
            te.status = "FAILED"
            te.error = str(e)
            await emit(f"❌ Exception during health audit: {str(e)}")
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
            project = parameters.get("project", "mom")
            component = parameters.get("component", "backend")
            environment = parameters.get("environment", "uat")
            branch = parameters.get("branch", "main")
            
            await emit(f"🚀 Starting backend deployment for project '{project}' (branch: {branch})...")
            
            # Find matching deployment config
            async with AsyncSessionLocal() as db_session:
                stmt = select(ProjectDeployment).where(
                    ProjectDeployment.component == component
                )
                result = await db_session.execute(stmt)
                pd = result.scalars().first()
            
            if not pd:
                err_msg = f"No deployment config found for {project}/{component}"
                await emit(f"❌ {err_msg}")
                te.status = "FAILED"
                te.error = err_msg
                await session.commit()
                return {"status": "FAILED", "output": te.output}
            
            # Get target server for the environment
            async with AsyncSessionLocal() as db_session:
                stmt = select(Server).where(Server.environment_id == pd.environment_id)
                result = await db_session.execute(stmt)
                server = result.scalars().first()
            
            if not server:
                err_msg = "No target server configured for environment"
                await emit(f"❌ {err_msg}")
                te.status = "FAILED"
                te.error = err_msg
                await session.commit()
                return {"status": "FAILED", "output": te.output}
            
            host_key = f"{server.environment_id}:{server.name}"
            executor = get_ssh_executor()
            
            await emit(f"📡 Connecting to {server.name} ({server.hostname}:{server.port})...")
            repo_path = pd.repository_path or "/opt/app/backend"
            await emit(f"📂 Navigating to repository path: {repo_path}")
            
            # Git checkout and sync
            cmd_git = f"cd {repo_path} && git fetch origin && git checkout {branch} && git pull origin {branch}"
            await emit(f"⚡ Fetching and pulling branch '{branch}'...")
            git_res = await executor.execute(host_key, cmd_git, timeout=120)
            
            if git_res.exit_code != 0:
                err_msg = f"Git checkout failed (code {git_res.exit_code}): {git_res.stderr or git_res.stdout}"
                await emit(f"❌ {err_msg}")
                te.status = "FAILED"
                te.error = err_msg
                await session.commit()
                return {"status": "FAILED", "output": te.output}
            
            await emit(f"✅ Checked out branch '{branch}'")
            
            # Run deployment script
            deploy_script = pd.deployment_script or "./deploy_backend.sh"
            await emit(f"🔨 Running backend deployment script: {deploy_script}...")
            cmd_deploy = f"cd {repo_path} && chmod +x {deploy_script} && {deploy_script}"
            deploy_res = await executor.execute(host_key, cmd_deploy, timeout=300)
            
            if deploy_res.exit_code != 0:
                err_msg = f"Deployment script failed (code {deploy_res.exit_code}): {deploy_res.stderr or deploy_res.stdout}"
                await emit(f"❌ {err_msg}")
                te.status = "FAILED"
                te.error = err_msg
                await session.commit()
                return {"status": "FAILED", "output": te.output}
            
            await emit("✅ Backend build & service restart completed.")
            
            # Health check
            health_url = pd.health_check_url
            if health_url:
                await emit(f"🩺 Running post-deploy health check: {health_url}...")
                await asyncio.sleep(2)
                cmd_health = f"curl -s -o /dev/null -w '%{{http_code}}' --max-time 15 {health_url}"
                health_res = await executor.execute(host_key, cmd_health, timeout=20)
                http_code = health_res.stdout.strip()
                if health_res.exit_code == 0 and http_code in ("200", "301", "302"):
                    await emit(f"✅ Health check PASSED (HTTP {http_code})")
                else:
                    err_msg = f"Health check returned unexpected code: HTTP {http_code}"
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