export type TaskStatus =
  | 'PENDING'
  | 'PLANNED'
  | 'AWAITING_CONFIRMATION'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'ROLLED_BACK';

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  assigned_projects?: string[];
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface APIKey {
  id: number;
  name: string;
  key_prefix: string;
  is_active: boolean;
  created_at?: string;
  expires_at?: string | null;
  last_used_at?: string | null;
  raw_key?: string;
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  username: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details?: Record<string, any> | null;
  ip_address?: string | null;
  timestamp?: string;
}

export interface WorkflowStep {
  tool: string;
  parameters?: Record<string, any>;
  description?: string;
  rollback_tool?: string | null;
  rollback_parameters?: Record<string, any> | null;
}

export interface ToolRequest {
  tool: string | null;
  parameters?: Record<string, any>;
  requires_confirmation?: boolean;
  confidence?: number;
  missing_information?: string[];
  question?: string | null;
  steps?: WorkflowStep[] | null;
}

export interface ChatPlanResponse {
  task_id: number;
  status: TaskStatus;
  execution_plan: {
    tool: string | null;
    parameters: Record<string, any>;
    requires_confirmation: boolean;
    confidence?: number;
    missing_information?: string[];
    question?: string | null;
    steps?: WorkflowStep[] | null;
  };
}

export interface TaskExecution {
  id: number;
  task_id: number;
  tool_name: string | null;
  parameters: Record<string, any> | null;
  output: string | null;
  error: string | null;
  status: string;
  is_rollback?: boolean;
  started_at: string | null;
  completed_at: string | null;
}

export interface Task {
  id: number;
  user_id?: number | null;
  user_request: string;
  intent: string | null;
  status: TaskStatus;
  requires_confirmation: boolean;
  workflow_dag?: WorkflowStep[] | null;
  current_step_index?: number;
  is_rollback?: boolean;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_message: string | null;
  executions?: TaskExecution[];
}

export interface Server {
  id: number;
  name: string;
  hostname: string;
  port: number;
  username: string;
  environment_id?: number | null;
  environment_name?: string;
  authentication_method: string;
  password?: string;
  has_password?: boolean;
  ssh_key?: string;
}

export interface ServerTestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
  system_info?: string;
}

export interface ServerHealthAuditResult {
  server_id: number;
  server_name: string;
  hostname: string;
  success: boolean;
  status: string;
  cpu_usage?: string;
  memory_usage?: string;
  disk_usage?: string;
  docker_status?: string;
  uptime?: string;
  logs: string[];
  checked_at: string;
}

export interface PreflightCheckResult {
  success: boolean;
  server_reachable: boolean;
  server_name?: string;
  server_host?: string;
  auth_method?: string;
  repo_directory_exists?: boolean;
  health_check_status?: string;
  details: string[];
}

export interface ProjectDeployment {
  id: number;
  project_id: number;
  environment_id: number;
  server_id?: number | null;
  server_name?: string | null;
  server_hostname?: string | null;
  component: string;
  repository_path?: string | null;
  deployment_script?: string | null;
  health_check_url?: string | null;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  repository_url?: string | null;
  deployments?: ProjectDeployment[];
}

export interface Environment {
  id: number;
  name: string;
  description?: string | null;
  servers?: Server[];
}

export interface SystemStats {
  total_tasks: number;
  running_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
  total_servers: number;
  total_projects: number;
  total_environments: number;
}

export interface ObservabilityData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {
    status: string;
    latency_ms: number;
    pool?: {
      pool_size?: number;
      checkedin?: number;
      checkedout?: number;
      overflow?: number;
    };
  };
  metrics: {
    total_tasks: number;
    success_tasks: number;
    failed_tasks: number;
    running_tasks: number;
    success_rate_percent: number;
  };
  k8s_probes: {
    liveness: string;
    readiness: string;
  };
  timestamp: string;
}

export interface ScheduledTask {
  id: number;
  name: string;
  cron_expression: string;
  user_request: string;
  is_active: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
  created_at?: string;
}

export interface WebhookSubscription {
  id: number;
  name: string;
  url: string;
  event_types: string[];
  is_active: boolean;
  created_at?: string;
}

export interface PolicyRule {
  id: number;
  name: string;
  environment: string;
  block_weekends: boolean;
  allowed_hours_start: number;
  allowed_hours_end: number;
  require_double_confirm: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface LLMProviderStatus {
  active_provider: string;
  active_model: string;
  active_base_url?: string;
  available_providers: string[];
}

export interface LogStreamEvent {
  task_id: number;
  execution_id?: number;
  log?: string;
  output?: string;
  status?: TaskStatus;
  timestamp?: string;
  type?: 'init' | 'complete';
  executions?: any[];
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  created_at: string;
  running: boolean;
}

export interface ServerContainers {
  server_id: number;
  server_name: string;
  hostname: string;
  environment: string;
  containers: DockerContainer[];
  reachable: boolean;
  error?: string;
}
