# AgentOps - Backend (Phase 1)

This folder contains the Phase 1 implementation of AgentOps: a FastAPI backend that implements:

- Async SQLAlchemy models for Projects, Environments, Servers, Deployments, Tasks and TaskExecutions
- Ollama-compatible LLM wrapper with a safe JSON-only parsing layer and a mock fallback
- Allowlist-based tool registry and a mock `deploy_frontend` tool
- REST API endpoints for chat, task lifecycle and simple queries
- Simple sample seed data created at startup when DB is empty

See ../.env.example for configuration.

Start (development):

1. Create a Python 3.11 virtualenv
2. pip install -r requirements.txt
3. Ensure PostgreSQL is running and DATABASE_URL is set
4. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

This phase focuses on the backend core. Frontend and advanced tooling are planned for later phases.
