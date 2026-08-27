import os
import re
import json
import logging
from typing import Dict, Any, Optional, List
import httpx

from app.schemas import ToolRequest, WorkflowStep
from app.llm.base import LLMClient
from app.llm.ollama import OllamaClient

logger = logging.getLogger(__name__)


class MultiLLMClient(LLMClient):
    """
    Unified Multi-Provider LLM Gateway.
    Supports dynamic switching between Ollama, Groq, OpenRouter, DeepSeek, Together AI,
    custom OpenAI-compatible endpoints, OpenAI, Anthropic, Gemini, and deterministic heuristics.
    """
    PROVIDER_BASE_URLS = {
        "openai": "https://api.openai.com/v1",
        "nvidia": "https://integrate.api.nvidia.com/v1",
        "groq": "https://api.groq.com/openai/v1",
        "openrouter": "https://openrouter.ai/api/v1",
        "deepseek": "https://api.deepseek.com/v1",
        "together": "https://api.together.xyz/v1",
    }

    DEFAULT_MODELS = {
        "ollama": "qwen3",
        "nvidia": "meta/llama-3.3-70b-instruct",
        "groq": "llama-3.3-70b-versatile",
        "openrouter": "meta-llama/llama-3.3-70b-instruct",
        "deepseek": "deepseek-chat",
        "together": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "openai": "gpt-4o-mini",
        "anthropic": "claude-3-5-sonnet-20241022",
        "gemini": "gemini-1.5-flash",
    }

    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "ollama").lower()
        self.model = os.getenv("LLM_MODEL", os.getenv("OLLAMA_MODEL", self.DEFAULT_MODELS.get(self.provider, "qwen3")))
        self.ollama_client = OllamaClient()
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.nvidia_api_key = os.getenv("NVIDIA_API_KEY", "")
        self.groq_api_key = os.getenv("GROQ_API_KEY", "")
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
        self.deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "")
        self.together_api_key = os.getenv("TOGETHER_API_KEY", "")
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.custom_api_key = os.getenv("LLM_API_KEY", "")
        self.custom_base_url = os.getenv("LLM_BASE_URL", "")

    def set_provider(self, provider: str, model: Optional[str] = None, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.provider = provider.lower()
        if model:
            self.model = model
        elif not self.model or self.provider in self.DEFAULT_MODELS:
            self.model = self.DEFAULT_MODELS.get(self.provider, self.model)

        if base_url:
            self.custom_base_url = base_url

        if api_key:
            if self.provider == "openai":
                self.openai_api_key = api_key
            elif self.provider == "nvidia":
                self.nvidia_api_key = api_key
            elif self.provider == "groq":
                self.groq_api_key = api_key
            elif self.provider == "openrouter":
                self.openrouter_api_key = api_key
            elif self.provider == "deepseek":
                self.deepseek_api_key = api_key
            elif self.provider == "together":
                self.together_api_key = api_key
            elif self.provider == "anthropic":
                self.anthropic_api_key = api_key
            elif self.provider == "gemini":
                self.gemini_api_key = api_key
            else:
                self.custom_api_key = api_key

    def get_status(self) -> Dict[str, Any]:
        active_url = self.custom_base_url or self.PROVIDER_BASE_URLS.get(self.provider, "")
        return {
            "active_provider": self.provider,
            "active_model": self.model,
            "active_base_url": active_url,
            "available_providers": [
                "ollama", "nvidia", "groq", "openrouter", "deepseek", "together",
                "openai_compatible", "openai", "anthropic", "gemini", "heuristic_fallback"
            ]
        }

    async def parse(self, user_message: str, context: Dict[str, Any]) -> ToolRequest:
        """Route to active provider with graceful fallback chain."""
        try:
            if self.provider in ("openai", "nvidia", "groq", "openrouter", "deepseek", "together", "openai_compatible"):
                key = self._get_active_api_key()
                if key or self.provider == "openai_compatible":
                    base_url = self.custom_base_url or self.PROVIDER_BASE_URLS.get(self.provider, "https://api.openai.com/v1")
                    return await self._parse_openai_compatible(base_url, key, self.model, user_message, context)
            elif self.provider == "anthropic" and self.anthropic_api_key:
                return await self._parse_anthropic(user_message, context)
            elif self.provider == "gemini" and self.gemini_api_key:
                return await self._parse_gemini(user_message, context)
            elif self.provider == "ollama":
                return await self.ollama_client.parse(user_message, context)
        except Exception as e:
            logger.warning(f"Primary LLM provider '{self.provider}' failed: {e}. Falling back to deterministic heuristic parser.")

        # Fallback to deterministic heuristic parser
        return self._heuristic_parse(user_message, context)

    def _get_active_api_key(self) -> str:
        if self.provider == "openai":
            return self.openai_api_key
        elif self.provider == "nvidia":
            return self.nvidia_api_key or self.custom_api_key
        elif self.provider == "groq":
            return self.groq_api_key or self.custom_api_key
        elif self.provider == "openrouter":
            return self.openrouter_api_key or self.custom_api_key
        elif self.provider == "deepseek":
            return self.deepseek_api_key or self.custom_api_key
        elif self.provider == "together":
            return self.together_api_key or self.custom_api_key
        return self.custom_api_key or self.openai_api_key

    def _build_system_prompt(self, context: Dict[str, Any]) -> str:
        allowed_tools = context.get("allowed_tools", [
            "deploy_frontend", "deploy_backend", "docker_status",
            "restart_container", "server_health_check", "get_server_metrics"
        ])
        projects = context.get("projects", ["agentops", "ecommerce-app", "crm-system", "mom"])
        environments = context.get("environments", ["dev", "qa", "uat", "production", "prod"])
        servers = context.get("servers", [])
        recent_tasks = context.get("recent_tasks", [])

        recent_tasks_str = ""
        if recent_tasks:
            recent_tasks_str = f"\n8. Recent task history (last {len(recent_tasks)}): {json.dumps(recent_tasks)}. Use this to answer questions like 'what was deployed last?' or 'what is the status of the last task?'."

        return f"""You are the strict AI DevOps Orchestrator for AgentOps.
Always and only respond with a valid JSON object matching the ToolRequest schema:
{{
  "tool": "<tool_name or null>",
  "parameters": {{ ... }},
  "requires_confirmation": <true|false>,
  "confidence": <float between 0.0 and 1.0>,
  "missing_information": [],
  "question": "<conversational greeting or clarification message when tool is null>",
  "steps": null
}}

Guidelines:
1. For greetings (e.g. "hi", "hello", "hey") or general questions, set "tool": null and provide a friendly greeting in "question".
2. If the user asks for a DevOps operation, select from allowed_tools: {json.dumps(allowed_tools)}.
3. Mutating operations (deploy_frontend, deploy_backend, restart_container) MUST have "requires_confirmation": true.
4. Read-only operations (server_health_check, docker_status, get_server_metrics) MUST have "requires_confirmation": false.
5. Known projects: {json.dumps(projects)}. Known environments: {json.dumps(environments)}.
6. Known registered servers: {json.dumps(servers)}. When the user asks about a specific server (e.g. 'physical server', 'KC-server'), pass "server": "<matched_server_name>" in parameters.
7. Use get_server_metrics when user asks about server metrics, disk usage, memory, CPU, uptime, or running containers on a specific server.{recent_tasks_str}
Respond with pure JSON only without markdown formatting."""

    def _json_to_tool_request(self, data: Any) -> ToolRequest:
        if isinstance(data, dict):
            tool = data.get("tool")
            if tool in ("null", "None", "", None):
                tool = None
            parameters = data.get("parameters") or {}
            req_confirm = bool(data.get("requires_confirmation", False))
            confidence = float(data.get("confidence", 0.9)) if data.get("confidence") is not None else 0.9
            question = data.get("question") or data.get("message") or data.get("response") or data.get("reply")

            steps = None
            if "steps" in data and isinstance(data["steps"], list):
                steps = []
                for s in data["steps"]:
                    if isinstance(s, dict):
                        steps.append(WorkflowStep(**s))

            return ToolRequest(
                tool=tool,
                parameters=parameters,
                requires_confirmation=req_confirm,
                confidence=confidence,
                missing_information=data.get("missing_information", []),
                question=question,
                steps=steps
            )
        return ToolRequest(tool=None, question=str(data))

    def _extract_json(self, raw_text: str) -> Any:
        text = raw_text.strip()
        # Strip markdown code blocks if present
        if text.startswith("```"):
            lines = text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()

        try:
            return json.loads(text)
        except Exception:
            m = re.search(r"\{.*\}", text, re.S)
            if m:
                return json.loads(m.group(0))
            raise ValueError(f"Could not parse valid JSON from LLM output: {raw_text[:200]}")

    async def _parse_openai_compatible(
        self, base_url: str, api_key: str, model_name: str, user_message: str, context: Dict[str, Any]
    ) -> ToolRequest:
        url = f"{base_url.rstrip('/')}/chat/completions"
        headers = {
            "Content-Type": "application/json"
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        system_prompt = self._build_system_prompt(context)
        payload = {
            "model": model_name or "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            raw_text = data["choices"][0]["message"]["content"]
            parsed_json = self._extract_json(raw_text)
            return self._json_to_tool_request(parsed_json)

    async def _parse_anthropic(self, user_message: str, context: Dict[str, Any]) -> ToolRequest:
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        system_prompt = self._build_system_prompt(context)
        payload = {
            "model": self.model if "claude" in self.model else "claude-3-5-sonnet-20241022",
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_message}],
            "temperature": 0.1
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            raw_text = data["content"][0]["text"]
            parsed_json = self._extract_json(raw_text)
            return self._json_to_tool_request(parsed_json)

    async def _parse_gemini(self, user_message: str, context: Dict[str, Any]) -> ToolRequest:
        model_name = self.model if "gemini" in self.model else "gemini-1.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.gemini_api_key}"
        headers = {"Content-Type": "application/json"}
        system_prompt = self._build_system_prompt(context)
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_message}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1}
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed_json = self._extract_json(raw_text)
            return self._json_to_tool_request(parsed_json)

    def _heuristic_parse(self, msg: str, context: Dict[str, Any]) -> ToolRequest:
        """Deterministic NLP regex matcher supporting single tools and multi-step DAG workflows."""
        m = msg.strip().lower()

        # Conversational greetings & questions
        greetings = ["hi", "hello", "hey", "hola", "howdy", "sup", "greetings", "good morning", "good afternoon", "good evening"]
        if m in greetings or re.match(r'^(?:hi|hello|hey|greetings)\b', m):
            return ToolRequest(
                tool=None,
                parameters={},
                requires_confirmation=False,
                confidence=1.0,
                question="Hello! I am your AgentOps DevOps Assistant. Tell me what you would like to deploy, monitor, or inspect across your infrastructure."
            )

        if any(w in m for w in ["who are you", "what can you do", "help", "commands"]):
            return ToolRequest(
                tool=None,
                parameters={},
                requires_confirmation=False,
                confidence=1.0,
                question="I can help you orchestrate infrastructure and deployments: deploy frontend/backend services, execute multi-step CI/CD DAGs, check fleet server health, and inspect or restart Docker containers."
            )

        projects = context.get("projects", ["agentops", "ecommerce-app", "crm-system", "mom"])
        environments = context.get("environments", ["dev", "qa", "uat", "production", "prod"])
        servers = context.get("servers", [])

        matched_project = next((p for p in projects if p.lower() in m), None)
        if not matched_project:
            p_match = re.search(r'(?:deploy|for|project)\s+([a-zA-Z0-9_\-]+)', msg, re.I)
            if p_match:
                cand = p_match.group(1).strip()
                if cand.lower() not in ["frontend", "backend", "full", "pipeline", "to", "branch", "on", "in", "the", "a"]:
                    matched_project = cand
        if not matched_project:
            matched_project = "agentops"
        matched_env = next((e for e in environments if e.lower() in m), None)
        if matched_env == "prod":
            matched_env = "production"

        matched_server = None
        # 1. Direct full name match
        for s in servers:
            if s.lower() in m:
                matched_server = s
                break

        # 2. Token / keyword match (e.g. "physical" in "Xy-physical-server", "kc" in "KC-server")
        if not matched_server:
            for s in servers:
                tokens = [t.lower() for t in re.split(r'[-_.\s]+', s) if len(t) > 2 and t.lower() not in ["server", "node", "host", "internal", "compute", "general"]]
                if any(re.search(rf'\b{re.escape(token)}\b', m) for token in tokens):
                    matched_server = s
                    break

        # 3. Explicit prefix pattern match (e.g. "server KC-server")
        if not matched_server:
            s_match = re.search(r'(?:server|node|host|on)\s+([a-zA-Z0-9_\-]+(?:-server|\.internal)?)', msg, re.I)
            if s_match:
                candidate = s_match.group(1).strip()
                if candidate.lower() not in ["uat", "qa", "dev", "prod", "production", "test", "servers", "health", "docker", "containers"]:
                    matched_server = candidate

        # Check for Multi-step Full Deployment Pipeline (DAG)
        if any(w in m for w in ["full pipeline", "ci/cd pipeline", "full deployment", "safe deploy", "pipeline"]):
            effective_env = matched_env or "production"
            return ToolRequest(
                tool="deploy_backend",
                requires_confirmation=True,
                confidence=0.98,
                parameters={"project": matched_project, "environment": effective_env, "component": "backend"},
                steps=[
                    WorkflowStep(
                        tool="server_health_check",
                        parameters={"environment": effective_env},
                        description="Pre-deployment environment health audit"
                    ),
                    WorkflowStep(
                        tool="deploy_backend",
                        parameters={"project": matched_project, "environment": effective_env, "component": "backend"},
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
                    ),
                    WorkflowStep(
                        tool="server_health_check",
                        parameters={"environment": effective_env},
                        description="Post-deployment verification and SLA health check"
                    )
                ]
            )

        # Dynamic Deploy Handler (supports frontend, backend, or custom components like WD-Node, DRF-FE, etc.)
        if "deploy" in m:
            b_match = re.search(r'branch\s+([a-zA-Z0-9_\-\./]+)', msg, re.I)
            matched_branch = b_match.group(1).strip() if b_match else "main"

            comp = None
            if "frontend" in m:
                comp = "frontend"
            elif "backend" in m or "api" in m:
                comp = "backend"
            else:
                pattern = r'deploy\s+(?:' + (re.escape(matched_project) + r'\s+' if matched_project else '') + r')([a-zA-Z0-9_\-]+)'
                c_match = re.search(pattern, msg, re.I)
                if c_match:
                    cand = c_match.group(1).strip()
                    if cand.lower() not in ["branch", "to", "on", "in", "the", "a", "all", "project", "server", "uat", "qa", "dev", "develop", "prod", "production"]:
                        comp = cand
            if not comp:
                comp = "backend"

            tool_to_use = "deploy_frontend" if comp.lower() == "frontend" else "deploy_backend"
            return ToolRequest(
                tool=tool_to_use,
                parameters={
                    "project": matched_project,
                    "environment": matched_env or "uat",
                    "component": comp,
                    "branch": matched_branch
                },
                requires_confirmation=True,
                confidence=0.98
            )

        # Docker Status
        if "docker" in m or "container" in m or "status" in m or "ps" in m:
            docker_params: Dict[str, Any] = {"project": matched_project}
            if matched_server:
                docker_params["server"] = matched_server
            if matched_env:
                docker_params["environment"] = matched_env
            return ToolRequest(
                tool="docker_status",
                parameters=docker_params,
                requires_confirmation=False,
                confidence=0.95
            )

        # Health Check
        if "health" in m or "ping" in m or "check" in m or "audit" in m:
            health_params: Dict[str, Any] = {}
            if matched_server:
                health_params["server"] = matched_server
            if matched_env:
                health_params["environment"] = matched_env
            if not matched_server and not matched_env:
                health_params["environment"] = "uat"
            return ToolRequest(
                tool="server_health_check",
                parameters=health_params,
                requires_confirmation=False,
                confidence=0.95
            )

        # Restart Container
        if "restart" in m:
            c_name = f"{matched_project}-backend"
            restart_params: Dict[str, Any] = {"container_name": c_name}
            if matched_server:
                restart_params["server"] = matched_server
            if matched_env:
                restart_params["environment"] = matched_env
            return ToolRequest(
                tool="restart_container",
                parameters=restart_params,
                requires_confirmation=True,
                confidence=0.90
            )

        # Non-matching input: Clarify rather than trigger accidental executions
        return ToolRequest(
            tool=None,
            parameters={},
            requires_confirmation=False,
            confidence=0.50,
            question="I didn't recognize a specific DevOps action for that request. Try asking: 'Deploy MOM frontend to UAT', 'Check server health', or 'Docker status'."
        )


multi_llm = MultiLLMClient()

