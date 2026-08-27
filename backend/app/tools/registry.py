from typing import Dict, Callable, Any
from app.tools import deployment, docker_tools

ALLOWED_TOOLS = {
    "deploy_frontend",
    "deploy_backend",
    "docker_status",
    "restart_container",
    "server_health_check",
    "get_server_metrics",
}

TOOL_MAP: Dict[str, Callable[..., Any]] = {
    "deploy_frontend": deployment.deploy_frontend,
    "deploy_backend": docker_tools.deploy_backend,
    "docker_status": docker_tools.docker_status,
    "restart_container": docker_tools.restart_container,
    "server_health_check": docker_tools.server_health_check,
    "get_server_metrics": docker_tools.get_server_metrics,
}

def get_tool(tool_name: str):
    if tool_name not in ALLOWED_TOOLS:
        return None
    return TOOL_MAP.get(tool_name)
