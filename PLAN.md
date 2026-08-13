AgentOps Phase 1 Plan

Goals (Phase 1):
- FastAPI backend
- PostgreSQL async models
- Ollama LLM wrapper with strict JSON parsing and a safe mock fallback
- Allowlist-based tool registry (deploy_frontend mock implemented)
- REST API endpoints for chat and tasks
- Seed sample data on startup
- Basic unit tests for LLM parsing, tool validation and task lifecycle

Next steps (Phase 2+):
- Implement SSH execution layer and real deployment scripts
- Implement Docker and health check tools
- Add frontend React/TypeScript app and SSE-based logs
- Add authentication and RBAC
- Add alembic migrations and production hardening
