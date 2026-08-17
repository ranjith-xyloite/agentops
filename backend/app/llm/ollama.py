import json
import logging
import re
import httpx
from typing import Dict, Any
from app.llm.base import LLMClient
from app.schemas import ToolRequest
from app.config import settings

logger = logging.getLogger("agentops.llm")

SYSTEM_PROMPT = r"""
You are a strict parser assistant for AgentOps. Always and only respond with JSON matching the ToolRequest schema.
Valid keys: tool, parameters (object), requires_confirmation (bool), confidence (float), missing_information (array), question (string).
If you cannot produce a tool selection, return tool=null and include missing_information and a question field.
Never produce shell commands. Never invent new tools. Only pick from allowed_tools provided in the context.
"""


class OllamaClient(LLMClient):
    async def parse(self, user_message: str, context: Dict[str, Any]) -> ToolRequest:
        if not settings.OLLAMA_BASE_URL:
            return self._mock_parse(user_message)

        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Context: {json.dumps(context)}\nUser: {user_message}\nRespond with JSON only."}
            ],
            "stream": False,
            "options": {
                "num_predict": 1024,
                "temperature": 0.1
            }
        }

        url = f"{str(settings.OLLAMA_BASE_URL).rstrip('/')}/api/chat"
        
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                r = await client.post(url, json=payload)
                r.raise_for_status()
                data = r.json()
            
            text = data.get("message", {}).get("content", "")
            
            try:
                parsed_data = json.loads(text)
            except Exception:
                m = re.search(r"\{.*\}", text, re.S)
                if m:
                    parsed_data = json.loads(m.group(0))
                else:
                    return self._mock_parse(user_message)
            return ToolRequest(**parsed_data)

        except Exception as e:
            logger.warning(f"Ollama API request failed ({e}), falling back to deterministic parser.")
            return self._mock_parse(user_message)

    def _mock_parse(self, user_message: str) -> ToolRequest:
        """Deterministic heuristic fallback parser for fast local execution."""
        msg = user_message.lower()
        out = {
            "tool": None,
            "parameters": {},
            "requires_confirmation": False,
            "confidence": 0.8,
            "missing_information": [],
            "question": None
        }

        # Multi-step Full Deployment Pipeline (DAG)
        if any(w in msg for w in ["full pipeline", "ci/cd pipeline", "full deployment", "safe deploy", "pipeline"]):
            from app.schemas import WorkflowStep
            return ToolRequest(
                tool="deploy_backend",
                requires_confirmation=True,
                confidence=0.98,
                parameters={"project": "agentops", "environment": "production", "component": "backend"},
                steps=[
                    WorkflowStep(
                        tool="server_health_check",
                        parameters={"environment": "production"},
                        description="Pre-deployment health audit"
                    ),
                    WorkflowStep(
                        tool="deploy_backend",
                        parameters={"project": "agentops", "environment": "production", "component": "backend"},
                        description="Pull remote repository & execute deployment script",
                        rollback_tool="restart_container",
                        rollback_parameters={"container_name": "agentops-backend-prev"}
                    ),
                    WorkflowStep(
                        tool="restart_container",
                        parameters={"container_name": "agentops-backend"},
                        description="Gracefully restart container service",
                        rollback_tool="restart_container",
                        rollback_parameters={"container_name": "agentops-backend"}
                    )
                ]
            )

        if "deploy" in msg and "frontend" in msg:
            out.update({
                "tool": "deploy_frontend",
                "parameters": {"project": "mom", "component": "frontend", "branch": "main", "environment": "uat"},
                "requires_confirmation": True,
                "confidence": 0.95
            })
            for token in ["qa", "dev", "main", "master", "staging", "release"]:
                if token in msg:
                    out["parameters"]["branch"] = token
                    break
            for env in ["uat", "production", "prod", "qa", "staging", "dev"]:
                if env in msg:
                    out["parameters"]["environment"] = "uat" if env == "uat" else ("production" if env in ("production", "prod") else env)
                    break

        elif "deploy" in msg and "backend" in msg:
            out.update({
                "tool": "deploy_backend",
                "parameters": {"project": "mom", "component": "backend", "branch": "main", "environment": "uat"},
                "requires_confirmation": True,
                "confidence": 0.95
            })
            for token in ["qa", "dev", "main", "master", "staging", "release"]:
                if token in msg:
                    out["parameters"]["branch"] = token
                    break
            for env in ["uat", "production", "prod", "qa", "staging", "dev"]:
                if env in msg:
                    out["parameters"]["environment"] = "uat" if env == "uat" else ("production" if env in ("production", "prod") else env)
                    break

        elif "docker" in msg and ("status" in msg or "container" in msg or "ps" in msg):
            out.update({
                "tool": "docker_status",
                "parameters": {"environment": "uat"},
                "requires_confirmation": False,
                "confidence": 0.9
            })
            for env in ["uat", "production", "prod", "qa", "staging", "dev"]:
                if env in msg:
                    out["parameters"]["environment"] = "uat" if env == "uat" else ("production" if env in ("production", "prod") else env)
                    break

        elif "restart" in msg:
            out.update({
                "tool": "restart_container",
                "parameters": {"environment": "uat", "container_name": "mom-frontend"},
                "requires_confirmation": True,
                "confidence": 0.85
            })
            for env in ["uat", "production", "prod", "qa", "staging", "dev"]:
                if env in msg:
                    out["parameters"]["environment"] = "uat" if env == "uat" else ("production" if env in ("production", "prod") else env)
                    break

        elif "health" in msg or "check" in msg or "audit" in msg:
            out.update({
                "tool": "server_health_check",
                "parameters": {
                    "environment": "uat",
                    "checks": ["http", "tcp", "disk", "memory", "cpu"],
                    "url": "http://localhost:8000/api/health",
                    "port": 8000
                },
                "requires_confirmation": False,
                "confidence": 0.9
            })
            for env in ["uat", "production", "prod", "qa", "staging", "dev"]:
                if env in msg:
                    out["parameters"]["environment"] = "uat" if env == "uat" else ("production" if env in ("production", "prod") else env)
                    break

        return ToolRequest(**out)
