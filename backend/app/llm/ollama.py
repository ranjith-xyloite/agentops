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
            return self._mock_parse(user_message, context)

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
                    return self._mock_parse(user_message, context)
            return ToolRequest(**parsed_data)

        except Exception as e:
            logger.warning(f"Ollama API request failed ({e}), falling back to deterministic parser.")
            return self._mock_parse(user_message, context)

    def _mock_parse(self, user_message: str, context: Any = None) -> ToolRequest:
        """Deterministic heuristic fallback parser for fast local execution."""
        msg = user_message.lower()
        projects = (context or {}).get("projects", []) if isinstance(context, dict) else []
        matched_project = None
        for p in projects:
            if p.lower() in msg:
                matched_project = p
                break

        if not matched_project:
            p_match = re.search(r'(?:deploy|for|project)\s+([a-zA-Z0-9_\-]+)', msg, re.I)
            if p_match:
                cand = p_match.group(1).strip()
                if cand.lower() not in ["frontend", "backend", "full", "pipeline", "to", "branch", "on", "in", "the", "a"]:
                    matched_project = cand

        if not matched_project:
            matched_project = "agentops"

        greetings = ["hi", "hello", "hey", "hola", "howdy", "sup", "greetings", "good morning", "good afternoon", "good evening"]
        is_greeting = msg.strip() in greetings or re.match(r'^(?:hi|hello|hey|greetings)\b', msg.strip())
        default_question = (
            "Hello! I am your AgentOps DevOps Assistant. Tell me what you would like to deploy, monitor, or inspect across your infrastructure."
            if is_greeting else
            "I didn't recognize a specific DevOps action for that request. Try asking: 'Deploy MOM frontend to UAT', 'Check server health', or 'Docker status'."
        )

        out = {
            "tool": None,
            "parameters": {},
            "requires_confirmation": False,
            "confidence": 1.0 if is_greeting else 0.5,
            "missing_information": [],
            "question": default_question
        }

        # Multi-step Full Deployment Pipeline (DAG)
        if any(w in msg for w in ["full pipeline", "ci/cd pipeline", "full deployment", "safe deploy", "pipeline"]):
            from app.schemas import WorkflowStep
            return ToolRequest(
                tool="deploy_backend",
                requires_confirmation=True,
                confidence=0.98,
                parameters={"project": matched_project, "environment": "production", "component": "backend"},
                steps=[
                    WorkflowStep(
                        tool="server_health_check",
                        parameters={"environment": "production"},
                        description="Pre-deployment health audit"
                    ),
                    WorkflowStep(
                        tool="deploy_backend",
                        parameters={"project": matched_project, "environment": "production", "component": "backend"},
                        description="Pull remote repository & execute deployment script",
                        rollback_tool="restart_container",
                        rollback_parameters={"container_name": f"{matched_project}-backend-prev"}
                    ),
                    WorkflowStep(
                        tool="restart_container",
                        parameters={"container_name": f"{matched_project}-backend"},
                        description="Gracefully restart container service",
                        rollback_tool="restart_container",
                        rollback_parameters={"container_name": f"{matched_project}-backend"}
                    )
                ]
            )

        servers = (context or {}).get("servers", []) if isinstance(context, dict) else []

        # Extract target server if explicitly or partially mentioned (e.g. "physical server", "KC-server")
        matched_server = None
        for s in servers:
            if s.lower() in msg:
                matched_server = s
                break

        if not matched_server:
            for s in servers:
                tokens = [t.lower() for t in re.split(r'[-_.\s]+', s) if len(t) > 2 and t.lower() not in ["server", "node", "host", "internal", "compute", "general"]]
                if any(re.search(rf'\b{re.escape(token)}\b', msg) for token in tokens):
                    matched_server = s
                    break

        if not matched_server:
            s_match = re.search(r'(?:server|node|host|on)\s+([a-zA-Z0-9_\-]+(?:-server|\.internal)?)', msg, re.I)
            if s_match:
                candidate = s_match.group(1).strip()
                if candidate.lower() not in ["uat", "qa", "dev", "prod", "production", "test", "servers", "health", "docker", "containers"]:
                    matched_server = candidate

        if "deploy" in msg:
            b_match = re.search(r'branch\s+([a-zA-Z0-9_\-\./]+)', user_message, re.I)
            matched_branch = b_match.group(1).strip() if b_match else "main"

            comp = None
            if "frontend" in msg:
                comp = "frontend"
            elif "backend" in msg or "api" in msg:
                comp = "backend"
            else:
                pattern = r'deploy\s+(?:' + (re.escape(matched_project) + r'\s+' if matched_project else '') + r')([a-zA-Z0-9_\-]+)'
                c_match = re.search(pattern, user_message, re.I)
                if c_match:
                    cand = c_match.group(1).strip()
                    if cand.lower() not in ["branch", "to", "on", "in", "the", "a", "all", "project", "server", "uat", "qa", "dev", "develop", "prod", "production"]:
                        comp = cand
            if not comp:
                comp = "backend"

            matched_env = "uat"
            for env in ["develop", "dev", "uat", "qa", "staging", "production", "prod"]:
                if env in msg:
                    matched_env = "uat" if env == "uat" else ("production" if env in ("production", "prod") else env)
                    break

            tool_to_use = "deploy_frontend" if comp.lower() == "frontend" else "deploy_backend"
            out.update({
                "tool": tool_to_use,
                "parameters": {
                    "project": matched_project,
                    "component": comp,
                    "branch": matched_branch,
                    "environment": matched_env
                },
                "requires_confirmation": True,
                "confidence": 0.98
            })

        elif "docker" in msg and ("status" in msg or "container" in msg or "ps" in msg or "check" in msg):
            out.update({
                "tool": "docker_status",
                "parameters": {"environment": "uat"},
                "requires_confirmation": False,
                "confidence": 0.9
            })
            if matched_server:
                out["parameters"]["server"] = matched_server
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
            if matched_server:
                out["parameters"]["server"] = matched_server
            for env in ["uat", "production", "prod", "qa", "staging", "dev"]:
                if env in msg:
                    out["parameters"]["environment"] = "uat" if env == "uat" else ("production" if env in ("production", "prod") else env)
                    break

        elif "health" in msg or "check" in msg or "audit" in msg or "ping" in msg:
            out.update({
                "tool": "server_health_check",
                "parameters": {
                    "checks": ["http", "tcp", "disk", "memory", "cpu"],
                    "url": "http://localhost:8000/api/health",
                    "port": 8000
                },
                "requires_confirmation": False,
                "confidence": 0.9
            })
            if matched_server:
                out["parameters"]["server"] = matched_server
            matched_env = None
            for env in ["uat", "production", "prod", "qa", "staging", "dev"]:
                if env in msg:
                    matched_env = "uat" if env == "uat" else ("production" if env in ("production", "prod") else env)
                    break
            if matched_env:
                out["parameters"]["environment"] = matched_env
            elif not matched_server:
                out["parameters"]["environment"] = "uat"

        return ToolRequest(**out)
