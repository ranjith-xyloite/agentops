from typing import Dict, Callable, Any
from app.tools import deployment

ALLOWED_TOOLS = {
    "deploy_frontend",
    "deploy_backend",
    "docker_status",
    "restart_container",
    "server_health_check",
}

TOOL_MAP: Dict[str, Callable[..., Any]] = {
    "deploy_frontend": deployment.deploy_frontend,
    # backend deploy could be added later
}

def get_tool(tool_name: str):
    if tool_name not in ALLOWED_TOOLS:
        return None
    return TOOL_MAP.get(tool_name)
