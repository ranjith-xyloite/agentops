from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


class WorkflowStep(BaseModel):
    tool: str
    parameters: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    rollback_tool: Optional[str] = None
    rollback_parameters: Optional[Dict[str, Any]] = None


class ToolRequest(BaseModel):
    tool: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    requires_confirmation: bool = False
    confidence: Optional[float] = None
    missing_information: Optional[List[str]] = None
    question: Optional[str] = None
    steps: Optional[List[WorkflowStep]] = None  # Multi-step DAG workflow


class ChatRequest(BaseModel):
    message: str
    project: Optional[str] = None
    environment: Optional[str] = None


class ChatResponse(BaseModel):
    task_id: int
    status: str
    execution_plan: ToolRequest


class TaskOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_request: str
    intent: Optional[str]
    status: str
    requires_confirmation: bool
    workflow_dag: Optional[List[Dict[str, Any]]] = None
    current_step_index: Optional[int] = 0
    is_rollback: Optional[bool] = False
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    last_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TaskExecutionOut(BaseModel):
    id: int
    task_id: int
    tool_name: Optional[str]
    parameters: Optional[Dict[str, Any]]
    output: Optional[str]
    error: Optional[str]
    status: str
    is_rollback: Optional[bool] = False
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ServerOut(BaseModel):
    id: int
    name: str
    hostname: str
    port: int
    username: str
    environment_id: Optional[int] = None
    environment_name: Optional[str] = None
    authentication_method: str
    has_password: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)


class ServerCreate(BaseModel):
    name: str
    hostname: str
    port: int = 22
    username: str = "deploy"
    environment_id: Optional[int] = None
    authentication_method: str = "ssh_key"
    password: Optional[str] = None
    ssh_key: Optional[str] = None


class ServerUpdate(BaseModel):
    name: Optional[str] = None
    hostname: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    environment_id: Optional[int] = None
    authentication_method: Optional[str] = None
    password: Optional[str] = None
    ssh_key: Optional[str] = None



class ServerTestConnectionRequest(BaseModel):
    hostname: str
    port: int = 22
    username: str = "deploy"
    authentication_method: str = "password"
    password: Optional[str] = None
    ssh_key: Optional[str] = None


class ServerTestConnectionResponse(BaseModel):
    success: bool
    message: str
    latency_ms: Optional[int] = None
    system_info: Optional[str] = None


class ServerHealthAuditResponse(BaseModel):
    server_id: int
    server_name: str
    hostname: str
    success: bool
    status: str
    cpu_usage: Optional[str] = None
    memory_usage: Optional[str] = None
    disk_usage: Optional[str] = None
    docker_status: Optional[str] = None
    uptime: Optional[str] = None
    logs: List[str] = []
    checked_at: str


class PreflightCheckRequest(BaseModel):
    project_id: int
    environment_id: int
    component: Optional[str] = None


class PreflightCheckResponse(BaseModel):
    success: bool
    server_reachable: bool
    server_name: Optional[str] = None
    server_host: Optional[str] = None
    auth_method: Optional[str] = None
    repo_directory_exists: Optional[bool] = None
    health_check_status: Optional[str] = None
    details: List[str] = []



class ProjectDeploymentOut(BaseModel):
    id: int
    project_id: int
    environment_id: int
    server_id: Optional[int] = None
    server_name: Optional[str] = None
    server_hostname: Optional[str] = None
    component: str
    repository_path: Optional[str] = None
    deployment_script: Optional[str] = None
    health_check_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    repository_url: Optional[str] = None
    deployments: Optional[List[ProjectDeploymentOut]] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    repository_url: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    repository_url: Optional[str] = None


class ProjectDeploymentCreate(BaseModel):
    environment_id: int
    component: str
    server_id: Optional[int] = None
    repository_path: Optional[str] = None
    deployment_script: Optional[str] = None
    health_check_url: Optional[str] = None



class EnvironmentOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    servers: Optional[List[ServerOut]] = None

    model_config = ConfigDict(from_attributes=True)


class StatsOut(BaseModel):
    total_tasks: int
    running_tasks: int
    successful_tasks: int
    failed_tasks: int
    total_servers: int
    total_projects: int
    total_environments: int


# =========================================================
# Phase 4 Auth & RBAC Schemas
# =========================================================

class UserLogin(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    password: str = Field(..., min_length=6)
    role: str = "viewer"
    project_ids: Optional[List[int]] = None


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    project_ids: Optional[List[int]] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None
    assigned_projects: Optional[List[str]] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class ProjectMemberAssign(BaseModel):
    project_ids: List[int]


class APIKeyCreate(BaseModel):
    name: str
    expires_in_days: Optional[int] = None


class APIKeyOut(BaseModel):
    id: int
    name: str
    key_prefix: str
    is_active: bool
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class APIKeyCreatedOut(APIKeyOut):
    raw_key: str


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    username: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    timestamp: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# Phase 6 Schemas: Scheduler, Webhooks, Policies, Multi-LLM
# =========================================================

class ScheduledTaskCreate(BaseModel):
    name: str
    cron_expression: str
    user_request: str
    is_active: bool = True


class ScheduledTaskOut(BaseModel):
    id: int
    name: str
    cron_expression: str
    user_request: str
    is_active: bool
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class WebhookSubscriptionCreate(BaseModel):
    name: str
    url: str
    secret: Optional[str] = None
    event_types: Optional[List[str]] = None


class WebhookSubscriptionOut(BaseModel):
    id: int
    name: str
    url: str
    event_types: List[str]
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class WebhookTestRequest(BaseModel):
    url: str
    secret: Optional[str] = None


class PolicyRuleCreate(BaseModel):
    name: str
    environment: str = "production"
    block_weekends: bool = True
    allowed_hours_start: int = 8
    allowed_hours_end: int = 20
    require_double_confirm: bool = True
    is_active: bool = True


class PolicyRuleOut(BaseModel):
    id: int
    name: str
    environment: str
    block_weekends: bool
    allowed_hours_start: int
    allowed_hours_end: int
    require_double_confirm: bool
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LLMProviderConfig(BaseModel):
    provider: str  # "ollama", "openai", "anthropic", "gemini", "mock"
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None


class LLMProviderOut(BaseModel):
    active_provider: str
    active_model: str
    active_base_url: Optional[str] = None
    available_providers: List[str]


class ContainerTagRequest(BaseModel):
    tag: str

