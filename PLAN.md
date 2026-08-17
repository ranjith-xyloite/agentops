# AgentOps Master Development Plan

## Phase 1: Backend Foundation ✅ Completed
- FastAPI backend framework
- PostgreSQL async models (SQLAlchemy 2.0 + asyncpg)
- Ollama LLM wrapper with strict JSON parsing and deterministic fallback heuristics
- Allowlist-based tool registry
- REST API endpoints for chat and tasks
- Seed sample data via Alembic migrations
- Basic unit tests for LLM parsing and tool validation

---

## Phase 2: Core Tooling & Execution Layer ✅ Completed
- **AsyncSSH Execution Layer**: Connection pool (`SSHConnectionPool`) & high-level command runner (`SSHExecutor`) with timeout and streaming callbacks.
- **Production Execution Tools**:
  - `deploy_frontend`: Git sync, automated build script execution, HTTP health verification.
  - `deploy_backend`: Remote repository pull, deployment script execution, service restart, and health check audit.
  - `docker_status`: Container enumeration, status inspection, JSON formatting with project/component filtering.
  - `restart_container`: Graceful container restarts and docker state inspection.
  - `server_health_check`: HTTP, TCP, disk usage, memory utilization, and CPU load verification.
- **Structured Real-time Logging**: Task execution records with timestamps, exit codes, and live Server-Sent Events (SSE) broadcast queue.
- **Cancellation Support**: Task cancellation mechanics with background execution aborts (`POST /api/tasks/{task_id}/cancel`).
- **Comprehensive Test Suite**: Isolated async SQLite test database in `conftest.py` with mock SSH executor (26 tests passing).

---

## Phase 3: Frontend & Real-time UX ✅ Completed
- **Modern React + TypeScript + Vite Web App**: Clean, responsive layout with high-aesthetic dark engineering theme.
- **AI DevOps Command Center**: Natural language chat interface with quick action prompts and structured execution plan approval cards (`Confirm & Execute` / `Cancel`).
- **Real-time SSE Task Terminal**: Live streaming console logs with auto-scroll, status banner, copy logs, and abort action.
- **Task Lifecycle & Audit History**: Task history table with status filtering (`AWAITING_CONFIRMATION`, `RUNNING`, `SUCCESS`, `FAILED`, `CANCELLED`) and execution output inspection.
- **Server Fleet Management**: Node cards with instant health audits, environment badges, and add/delete node capabilities.
- **Project Deployments**: Component deployment mappings, repository paths, and quick deploy triggers.
- **Docker Compose Setup**: Multi-container Docker deployment (`PostgreSQL`, `FastAPI Backend`, `Nginx Frontend`).

---

## Phase 4: Authentication, Authorization & Multi-Tenancy ✅ Completed
- **3-Tier RBAC Hierarchy**: `Admin` (3), `Operator` (2), `Viewer` (1) with dependency-level role gates.
- **JWT & Password Security**: Bcrypt password hashing + 24h JWT access tokens & 7d refresh tokens with automatic Bearer header attachment.
- **Multi-Tenancy Project Scoping**: `ProjectMember` mapping restricting non-admins to their assigned projects.
- **CI/CD Programmatic API Keys**: `agops_<prefix>_<secret>` API key generator with SHA-256 hashing and dual `Authorization: Bearer` / `X-API-Key` auth.
- **Security Audit Logging**: Automatic logging of actor, action, resource, timestamp, and JSON details for all mutating operations.
- **Frontend RBAC UI**:
  - Login modal with 1-click demo logins (`Admin`, `Operator`, `Viewer`).
  - User Management panel with role assignment and multi-project scoping matrix.
  - API Keys management with one-time secret revelation modal and revocation controls.
  - Security audit log explorer with action filtering and JSON inspector drawer.
- **Automated Test Suite**: 36/36 backend tests in `pytest` passing with 100% coverage across RBAC, API keys, audit logs, and auth lifecycle.

---

## Phase 5: Production Hardening & Observability ✅ Completed
- **Prometheus Metrics Exporter**: Native `/metrics` and `/api/metrics` scraping endpoints exporting request rates, duration histograms, task completion rates, and connection gauges.
- **Prometheus Server**: Docker Compose integrated service (`prom/prometheus:v2.45.0` on port 9090).
- **Structured JSON Logging**: Standard JSON formatter with ISO-8601 timestamps, loglevel, module, line numbers, and automatic correlation ID binding.
- **Distributed Request Tracing**: `CorrelationIdMiddleware` injecting `X-Request-ID` and `X-Correlation-ID` across headers and execution logs.
- **Kubernetes Probes**: `GET /api/health/live` (Liveness) and `GET /api/health/ready` (Readiness with async DB pool verification).
- **Adaptive Rate Limiting**: Sliding-window client IP rate limiter (180 req/min general, 30 req/min auth) returning `429 Too Many Requests`.
- **Security Headers Middleware**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and X-XSS-Protection.
- **Database Connection Pool Tuning**: Configured asyncpg connection pool (`pool_size=20`, `max_overflow=10`, `pool_recycle=1800s`, `pool_pre_ping=True`).
- **Disaster Recovery Scripts**: `scripts/backup_db.py` (JSON dump & metadata generation) and `scripts/restore_db.py` (atomic restore).
- **GitHub Actions CI/CD Pipeline**: `.github/workflows/ci.yml` running linting, database migrations, backend pytest suite, frontend build, and Docker image builds.
- **Frontend Observability Dashboard**: Live cluster health indicator, real-time Kubernetes probe monitors, DB connection pool telemetry, and raw Prometheus metrics inspector.
- **Automated Test Suite**: 41/41 backend tests in `pytest` passing with 100% coverage.

---

## Phase 6: Advanced Agent Capabilities & Production Readiness (Final Product) ✅ Completed
- **Multi-Step Workflow DAGs & Automatic Rollbacks**:
  - Multi-step sequential deployment execution engine (`execute_workflow_dag`).
  - Automatic reverse-order compensation rollback (`_run_rollback_sequence`) on any step failure.
  - Task state machine support for `ROLLED_BACK` status and step index tracking.
- **Cron-Based Background Task Scheduler**:
  - Non-blocking `AsyncScheduler` background loop integrated with FastAPI application lifecycle.
  - Standard 5-part cron syntax parsing with shorthand aliases (`@hourly`, `@daily`, `@weekly`).
  - Full CRUD REST API (`/api/schedules`) with active/pause toggle.
- **Outbound Webhook Dispatcher**:
  - Asynchronous event dispatcher broadcasting to Slack, Discord, and custom endpoints.
  - Cryptographic HMAC-SHA256 signature verification in `X-AgentOps-Signature` headers.
  - Event triggers for `task.created`, `task.awaiting_confirmation`, `task.running`, `task.success`, `task.failed`, and `task.rolled_back`.
- **DevOps Guardrail Policy Engine**:
  - Automated deployment policy checks blocking weekend production deployments (Friday 18:00 to Sunday 23:59 UTC).
  - Configurable allowed maintenance time windows (e.g. 08:00 - 20:00 UTC) with Admin override capabilities.
- **Multi-LLM Gateway**:
  - Pluggable provider architecture supporting local Ollama (`qwen3`), OpenAI (`gpt-4o`), Anthropic (`claude-3-5-sonnet`), Google Gemini, and deterministic offline heuristics.
  - Dynamic runtime provider switching and configuration via API and UI.
- **Frontend Command Center Extensions**:
  - `SchedulerManager` component for scheduling recurring automation workflows with one-click presets.
  - `PoliciesAndWebhooks` component for managing outbound notifications and deployment safety guardrails.
  - `ChatConsole` Multi-Step DAG Pipeline Visualizer rendering live step checklists and rollback triggers.
  - `Navbar` dynamic Multi-LLM provider switcher modal and quick status badges.
- **Automated Test Suite & Verification**:
  - 49/49 backend tests in `pytest` passing with 100% coverage.
  - 0 TypeScript/Vite compiler errors on production build.
  - Complete 4-service Docker stack running in Docker Desktop (`agentops-backend`, `agentops-frontend`, `agentops-postgres`, `agentops-prometheus`).
