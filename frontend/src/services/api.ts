import {
  ChatPlanResponse,
  Task,
  Server,
  Project,
  ProjectDeployment,
  Environment,
  SystemStats,
  LogStreamEvent,
  User,
  AuthResponse,
  APIKey,
  AuditLog,
  ObservabilityData,
  ScheduledTask,
  WebhookSubscription,
  PolicyRule,
  LLMProviderStatus,
  ServerTestResult,
  ServerHealthAuditResult,
  PreflightCheckResult,
} from '../types';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('agentops_token');
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('agentops_token', token);
  } else {
    localStorage.removeItem('agentops_token');
  }
}

async function request(url: string, options: RequestInit = {}): Promise<any> {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    // If unauthorized, clear local session if token was invalid
    // and bubble up
    const err = await res.json().catch(() => ({ detail: 'Unauthorized' }));
    throw new Error(err.detail || 'Authentication required');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

// =========================================================
// Auth APIs
// =========================================================

export async function loginApi(username: string, password: string): Promise<AuthResponse> {
  return request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function registerApi(username: string, email: string, password: string, role = 'viewer'): Promise<User> {
  return request(`${API_BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ username, email, password, role }),
  });
}

export async function getMeApi(): Promise<User> {
  return request(`${API_BASE}/auth/me`);
}

// =========================================================
// User Management APIs (Admin)
// =========================================================

export async function listUsersApi(): Promise<User[]> {
  return request(`${API_BASE}/users`);
}

export async function createUserApi(data: {
  username: string;
  email: string;
  password: string;
  role: string;
  project_ids?: number[];
}): Promise<User> {
  return request(`${API_BASE}/users`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUserApi(
  userId: number,
  data: Partial<{
    email: string;
    role: string;
    is_active: boolean;
    password?: string;
    project_ids?: number[];
  }>
): Promise<User> {
  return request(`${API_BASE}/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteUserApi(userId: number): Promise<void> {
  return request(`${API_BASE}/users/${userId}`, {
    method: 'DELETE',
  });
}

export async function assignUserProjectsApi(userId: number, projectIds: number[]): Promise<any> {
  return request(`${API_BASE}/users/${userId}/projects`, {
    method: 'POST',
    body: JSON.stringify({ project_ids: projectIds }),
  });
}

// =========================================================
// API Key Management APIs
// =========================================================

export async function listApiKeysApi(): Promise<APIKey[]> {
  return request(`${API_BASE}/api-keys`);
}

export async function createApiKeyApi(name: string, expiresInDays?: number): Promise<APIKey> {
  return request(`${API_BASE}/api-keys`, {
    method: 'POST',
    body: JSON.stringify({ name, expires_in_days: expiresInDays }),
  });
}

export async function revokeApiKeyApi(keyId: number): Promise<void> {
  return request(`${API_BASE}/api-keys/${keyId}`, {
    method: 'DELETE',
  });
}

// =========================================================
// Security Audit Logs APIs
// =========================================================

export async function listAuditLogsApi(action?: string): Promise<AuditLog[]> {
  const url = action ? `${API_BASE}/audit-logs?action=${encodeURIComponent(action)}` : `${API_BASE}/audit-logs`;
  return request(url);
}

// =========================================================
// Core DevOps APIs
// =========================================================

export async function sendMessage(message: string): Promise<ChatPlanResponse> {
  return request(`${API_BASE}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function confirmTask(taskId: number): Promise<{ status: string }> {
  return request(`${API_BASE}/tasks/${taskId}/confirm`, {
    method: 'POST',
  });
}

export async function cancelTask(taskId: number): Promise<{ status: string }> {
  return request(`${API_BASE}/tasks/${taskId}/cancel`, {
    method: 'POST',
  });
}

export async function getTask(taskId: number): Promise<Task> {
  return request(`${API_BASE}/tasks/${taskId}`);
}

export async function listTasks(status?: string): Promise<Task[]> {
  const url = status ? `${API_BASE}/tasks?status=${encodeURIComponent(status)}` : `${API_BASE}/tasks`;
  return request(url);
}

export async function listServers(): Promise<Server[]> {
  return request(`${API_BASE}/servers`);
}

export async function createServer(data: Omit<Server, 'id' | 'environment_name'>): Promise<Server> {
  return request(`${API_BASE}/servers`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteServer(serverId: number): Promise<void> {
  return request(`${API_BASE}/servers/${serverId}`, {
    method: 'DELETE',
  });
}

export async function updateServerApi(
  serverId: number,
  data: Partial<Omit<Server, 'id' | 'environment_name'>>
): Promise<Server> {
  return request(`${API_BASE}/servers/${serverId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function testServerConnectionApi(data: {
  hostname: string;
  port?: number;
  username: string;
  authentication_method?: string;
  password?: string;
  ssh_key?: string;
}): Promise<ServerTestResult> {
  return request(`${API_BASE}/servers/test-connection`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function testExistingServerConnectionApi(serverId: number): Promise<ServerTestResult> {
  return request(`${API_BASE}/servers/${serverId}/test-connection`, {
    method: 'POST',
  });
}

export async function auditServerHealthApi(serverId: number): Promise<ServerHealthAuditResult> {
  return request(`${API_BASE}/servers/${serverId}/health-check`, {
    method: 'POST',
  });
}

export async function runPreflightCheckApi(data: {
  project_id: number;
  environment_id: number;
  component?: string;
}): Promise<PreflightCheckResult> {
  return request(`${API_BASE}/deployments/preflight-check`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listProjects(): Promise<Project[]> {
  return request(`${API_BASE}/projects`);
}

export async function createProject(data: { name: string; description?: string; repository_url?: string }): Promise<Project> {
  return request(`${API_BASE}/projects`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(projectId: number): Promise<void> {
  return request(`${API_BASE}/projects/${projectId}`, {
    method: 'DELETE',
  });
}

export async function updateProject(
  projectId: number,
  data: { name?: string; description?: string; repository_url?: string }
): Promise<Project> {
  return request(`${API_BASE}/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function createProjectDeployment(
  projectId: number,
  data: {
    environment_id: number;
    component: string;
    server_id?: number | null;
    repository_path?: string;
    deployment_script?: string;
    health_check_url?: string;
  }
): Promise<ProjectDeployment> {
  return request(`${API_BASE}/projects/${projectId}/deployments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteProjectDeployment(deploymentId: number): Promise<void> {
  return request(`${API_BASE}/projects/deployments/${deploymentId}`, {
    method: 'DELETE',
  });
}

export async function updateProjectDeployment(
  deploymentId: number,
  data: Partial<{
    environment_id: number;
    component: string;
    server_id?: number | null;
    repository_path?: string;
    deployment_script?: string;
    health_check_url?: string;
  }>
): Promise<ProjectDeployment> {
  return request(`${API_BASE}/projects/deployments/${deploymentId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function listEnvironments(): Promise<Environment[]> {
  return request(`${API_BASE}/environments`);
}

export async function getStats(): Promise<SystemStats> {
  return request(`${API_BASE}/stats`);
}

export async function getObservabilityDataApi(): Promise<ObservabilityData> {
  return request(`${API_BASE}/system/observability`);
}

export async function getRawPrometheusMetricsApi(): Promise<string> {
  const res = await fetch(`${API_BASE}/metrics`);
  return res.text();
}

// =========================================================
// Phase 6: Scheduler, Webhooks, Policies, Multi-LLM APIs
// =========================================================

export async function listSchedulesApi(): Promise<ScheduledTask[]> {
  return request(`${API_BASE}/schedules`);
}

export async function createScheduleApi(data: { name: string; cron_expression: string; user_request: string; is_active?: boolean }): Promise<ScheduledTask> {
  return request(`${API_BASE}/schedules`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteScheduleApi(id: number): Promise<void> {
  return request(`${API_BASE}/schedules/${id}`, {
    method: 'DELETE',
  });
}

export async function toggleScheduleApi(id: number): Promise<{ status: string; is_active: boolean }> {
  return request(`${API_BASE}/schedules/${id}/toggle`, {
    method: 'POST',
  });
}

export async function listWebhooksApi(): Promise<WebhookSubscription[]> {
  return request(`${API_BASE}/webhooks`);
}

export async function createWebhookApi(data: { name: string; url: string; secret?: string; event_types?: string[] }): Promise<WebhookSubscription> {
  return request(`${API_BASE}/webhooks`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteWebhookApi(id: number): Promise<void> {
  return request(`${API_BASE}/webhooks/${id}`, {
    method: 'DELETE',
  });
}

export async function testWebhookApi(data: { url: string; secret?: string }): Promise<any> {
  return request(`${API_BASE}/webhooks/test`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listPoliciesApi(): Promise<PolicyRule[]> {
  return request(`${API_BASE}/policies`);
}

export async function createPolicyApi(data: { name: string; environment: string; block_weekends: boolean; allowed_hours_start: number; allowed_hours_end: number; require_double_confirm: boolean; is_active?: boolean }): Promise<PolicyRule> {
  return request(`${API_BASE}/policies`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deletePolicyApi(id: number): Promise<void> {
  return request(`${API_BASE}/policies/${id}`, {
    method: 'DELETE',
  });
}

export async function getLLMStatusApi(): Promise<LLMProviderStatus> {
  return request(`${API_BASE}/system/llm`);
}

export async function setLLMProviderApi(data: { provider: string; model_name?: string; api_key?: string }): Promise<any> {
  return request(`${API_BASE}/system/llm`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function subscribeToTaskEvents(
  taskId: number,
  onEvent: (event: LogStreamEvent) => void,
  onError?: (err: any) => void
): () => void {
  const token = getAuthToken();
  const url = token ? `${API_BASE}/tasks/${taskId}/events?token=${encodeURIComponent(token)}` : `${API_BASE}/tasks/${taskId}/events`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data);
    } catch (e) {
      console.warn('Failed to parse SSE event data:', event.data);
    }
  };

  eventSource.onerror = (err) => {
    if (onError) onError(err);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}
