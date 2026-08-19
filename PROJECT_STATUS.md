# AgentOps — Project Status & System Architecture Report

**Version**: `v6.0.0 (Production Ready)`  
**Platform**: Autonomous Multi-Environment DevOps & AI Infrastructure Orchestrator  
**Status**: 🟢 **All Systems Operational & Deployed**  
**Last Updated**: `2026-08-18`

---

## 1. Executive Summary

**AgentOps** is an enterprise-grade autonomous DevOps platform designed to bridge natural language AI intent with production infrastructure execution. It enables software teams to deploy, monitor, audit, and maintain distributed services across heterogeneous environments (Production, UAT, QA, Development) with strict guardrails, role-based access control, real-time telemetry, and zero third-party sidecar dependencies.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             AGENTOPS ECOSYSTEM                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┴───────────────────────────┐
          ▼                                                       ▼
┌──────────────────┐                                    ┌──────────────────┐
│   FRONTEND SPA   │                                    │ FASTAPI BACKEND  │
│ React+TS+Vite    │◄──── SSE / REST API (JWT/API-Key) ──►│ Python 3.11 Async│
│ VS Code Sidebar  │                                    │ Multi-LLM Engine │
│ Dark/Light Modes │                                    │ AsyncSSH Executor│
└──────────────────┘                                    └────────┬─────────┘
                                                                 │
          ┌──────────────────────────────┬───────────────────────┼──────────────────────────────┐
          ▼                              ▼                       ▼                              ▼
┌──────────────────┐           ┌──────────────────┐    ┌──────────────────┐           ┌──────────────────┐
│  POSTGRESQL 15   │           │ PROMETHEUS 2.45  │    │  TARGET FLEET    │           │ OUTBOUND HOOKS   │
│ Persistent Volume│           │ Metrics Exporter │    │ Direct AsyncSSH  │           │ Slack / Discord  │
│ Port 5433 -> 5432│           │ Port 9090        │    │ Port 22          │           │ HMAC-SHA256      │
└──────────────────┘           └──────────────────┘    └──────────────────┘           └──────────────────┘
```

---

## 2. Infrastructure & Deployment Status

All services are containerized via Docker Compose, running with live health checks and automatic restart policies:

| Container Name | Service | Internal Port | Host Port | Status | Health / Uptime |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `agentops-frontend` | React Nginx SPA | `80` | `3000` | 🟢 Running | Healthy (HTTP 200) |
| `agentops-backend` | FastAPI Uvicorn Server | `8000` | `8000` | 🟢 Running | Healthy (Liveness/Readiness OK) |
| `agentops-postgres` | PostgreSQL 15 Alpine | `5432` | `5433` | 🟢 Running | Healthy (`postgres-data` persistent volume) |
| `agentops-prometheus` | Prometheus Telemetry | `9090` | `9090` | 🟢 Running | Healthy (Scraping `/metrics` every 15s) |

---

## 3. Core Feature Modules & Capabilities

### ⚡ 1. Autonomous AI Console & Orchestrator
- **Natural Language DevOps**: Converts plain English commands (e.g. *"Deploy mom frontend branch main to uat"*, *"Check server health on production"*, *"Restart container api"*) into structured multi-step execution plans.
- **Safety Approval Gate**: Displays structured confirmation cards before executing mutating actions on remote nodes.
- **Multi-LLM Gateway**: Dynamic switching between **Local Ollama** (`qwen3`), **Groq** (`llama-3.3-70b`), **OpenRouter**, **DeepSeek**, **Together AI**, **OpenAI** (`gpt-4o`), **Anthropic** (`claude-3-5-sonnet`), **Google Gemini**, and an offline deterministic heuristic fallback.

### 🚀 2. 1-Click Deployment Hub & Workflow Deployer
- **Visual Matrix**: Fast dropdown selection of Project, Target Environment, and Git Branch.
- **Preflight Node Audits**: 1-click connectivity, path, and disk space checks before triggering deployments.
- **Multi-Step DAG & Auto-Rollback**: Executes complex multi-service pipelines sequentially, with automated reverse-order rollback compensation if any step fails.

### 📋 3. Live Task Execution Terminal
- **Real-Time Log Streaming**: Unbuffered Server-Sent Events (SSE) streaming remote stdout/stderr to the web terminal.
- **Interactive Pagination**: Task history table supporting 10, 20, 50, and 100 rows per page with status filtering (`RUNNING`, `SUCCESS`, `FAILED`, `CANCELLED`).
- **Emergency Abort**: Instant background task cancellation (`POST /api/v1/tasks/{id}/cancel`).

### 🖥️ 4. Server Fleet & SSH Executor
- **Native AsyncSSH Pool**: Zero external agent or MCP sidecar required on target machines.
- **Host Metrics**: Real-time CPU, RAM, Disk, Uptime, and Docker status audits.
- **Extended Timeouts**: Configured with high default timeouts (`DEPLOYMENT_TIMEOUT=1800s`, `GIT_TIMEOUT=1800s`) ensuring heavy Docker builds, Maven compiles, or NPM installs never prematurely time out.

### ⏰ 5. Autonomous Cron & Workflow Scheduler
- **Deploy Hub-Style Scheduling**: Schedule multi-component workflow deployments by selecting Project, Environment, Component, and Branch.
- **Standard Cron Cadence**: Supports 5-part cron syntax (`0 2 * * *`) and presets (`Every 15 mins`, `Hourly`, `Nightly 02:00`, `Daily 09:00`, `Weekly`).
- **On-Demand "Run Now"**: Trigger any scheduled job immediately on demand.

### 🛡️ 6. Governance Guardrails & Webhook Dispatcher
- **Change Window Policies**: Enforce weekend deploy blocks (Friday 18:00 to Sunday 23:59 UTC), maintenance hours, and dual-operator confirmations.
- **Cryptographic Webhooks**: Asynchronously dispatches events (`task.created`, `task.running`, `task.success`, `task.failed`, `task.rolled_back`) to Slack, Discord, or custom endpoints with HMAC-SHA256 signature verification.

### 🔒 7. Security, RBAC & Multi-Tenancy
- **3-Tier Role Hierarchy**: `Admin` (Full System), `Operator` (Deploy & Manage), `Viewer` (Read-only).
- **JWT & API Keys**: 24h JWT access tokens + programmatic `agops_<prefix>_<secret>` API keys.
- **Project Scoping**: Non-admin operators are strictly isolated to their assigned projects.
- **Immutable Audit Trail**: Logs every action, user ID, IP address, timestamp, and JSON delta.

### 📊 8. Observability & Telemetry
- **Prometheus Exporter**: Native `/metrics` endpoint exposing HTTP request rates, task durations, and connection gauges.
- **Kubernetes Probes**: Live `/api/health/live` and `/api/health/ready` endpoints.
- **Distributed Tracing**: Automatic `X-Request-ID` and `X-Correlation-ID` injection across requests.

---

## 4. UI/UX & Design Architecture

- **VS Code-Style Collapsible Sidebar**: Left activity rail with categorized navigation, quick search filter, and `Ctrl+B` toggle.
- **Multi-Theme Engine**: Seamless toggle between **Dark Mode**, **Light Mode**, and **System Theme** with CSS design tokens.
- **Responsive Layout**: Designed for high data density with smooth transitions, custom scrollbars, and accessible contrasting palettes.

---

## 5. Persistence & Data Storage

All application state is persisted in PostgreSQL 15 via the Docker volume `postgres-data`:

- **Database Connection**: `postgresql+asyncpg://agentops:agentops@postgres:5432/agentops`
- **Host Direct Access**: `localhost:5433` (User: `agentops`, Password: `agentops`, Database: `agentops`)
- **Key Tables**: `users`, `api_keys`, `projects`, `project_members`, `environments`, `servers`, `project_deployments`, `tasks`, `task_executions`, `scheduled_tasks`, `policy_rules`, `webhook_subscriptions`, `audit_logs`.

---

## 6. Verification & Quality Assurance

- **Backend Pytest Suite**: 49/49 automated unit and integration tests passing (`100% pass rate`).
- **Frontend TypeScript/Vite**: Clean compilation with 0 TypeScript/Lint errors.
- **Production Build**: Optimized SPA bundle (`dist/`) served through Alpine Nginx with 24-hour SSE timeout support.

---

## 7. Quick Access URLs

| Resource | URL | Credentials / Notes |
| :--- | :--- | :--- |
| **AgentOps UI** | `http://localhost:3000` | `admin` / `admin123` (or 1-click login) |
| **Backend OpenAPI Docs** | `http://localhost:8000/docs` | Interactive Swagger API Explorer |
| **Prometheus Dashboard** | `http://localhost:9090` | Raw Telemetry & Prometheus Queries |
| **Health Probe** | `http://localhost:8000/api/health/ready` | Readiness check (DB + System) |
