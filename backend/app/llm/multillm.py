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
    Supports dynamic switching between Ollama, OpenAI, Anthropic, Gemini, and deterministic heuristics.
    """
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "ollama").lower()
        self.model = os.getenv("LLM_MODEL", os.getenv("OLLAMA_MODEL", "qwen3"))
        self.ollama_client = OllamaClient()
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")

    def set_provider(self, provider: str, model: Optional[str] = None, api_key: Optional[str] = None):
        self.provider = provider.lower()
        if model:
            self.model = model
        if api_key:
            if self.provider == "openai":
                self.openai_api_key = api_key
            elif self.provider == "anthropic":
                self.anthropic_api_key = api_key
            elif self.provider == "gemini":
                self.gemini_api_key = api_key

    def get_status(self) -> Dict[str, Any]:
        return {
            "active_provider": self.provider,
            "active_model": self.model,
            "available_providers": ["ollama", "openai", "anthropic", "gemini", "heuristic_fallback"]
        }

    async def parse(self, user_message: str, context: Dict[str, Any]) -> ToolRequest:
        """Route to active provider with graceful fallback chain."""
        try:
            if self.provider == "openai" and self.openai_api_key:
                return await self._parse_openai(user_message, context)
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

    async def _parse_openai(self, user_message: str, context: Dict[str, Any]) -> ToolRequest:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json"
        }
        system_prompt = self.ollama_client._build_system_prompt(context)
        payload = {
            "model": self.model if "gpt" in self.model else "gpt-4o-mini",
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
            parsed_json = json.loads(raw_text)
            return self.ollama_client._json_to_tool_request(parsed_json)

    async def _parse_anthropic(self, user_message: str, context: Dict[str, Any]) -> ToolRequest:
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        system_prompt = self.ollama_client._build_system_prompt(context)
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
            parsed_json = json.loads(raw_text)
            return self.ollama_client._json_to_tool_request(parsed_json)

    async def _parse_gemini(self, user_message: str, context: Dict[str, Any]) -> ToolRequest:
        model_name = self.model if "gemini" in self.model else "gemini-1.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.gemini_api_key}"
        headers = {"Content-Type": "application/json"}
        system_prompt = self.ollama_client._build_system_prompt(context)
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_message}]}],
            "generationConfig": {"responseMimeType": "application/json"}
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed_json = json.loads(raw_text)
            return self.ollama_client._json_to_tool_request(parsed_json)

    def _heuristic_parse(self, msg: str, context: Dict[str, Any]) -> ToolRequest:
        """Deterministic NLP regex matcher supporting single tools and multi-step DAG workflows."""
        m = msg.lower()
        projects = context.get("projects", ["agentops", "ecommerce-app", "crm-system"])
        environments = context.get("environments", ["dev", "qa", "uat", "production", "prod"])

        matched_project = next((p for p in projects if p.lower() in m), "agentops")
        matched_env = next((e for e in environments if e.lower() in m), "dev")
        if matched_env == "prod":
            matched_env = "production"

        # Check for Multi-step Full Deployment Pipeline (DAG)
        if any(w in m for w in ["full pipeline", "ci/cd pipeline", "full deployment", "safe deploy", "pipeline"]):
            return ToolRequest(
                tool="deploy_backend",
                requires_confirmation=True,
                confidence=0.98,
                parameters={"project": matched_project, "environment": matched_env, "component": "backend"},
                steps=[
                    WorkflowStep(
                        tool="server_health_check",
                        parameters={"environment": matched_env},
                        description="Pre-deployment environment health audit"
                    ),
                    WorkflowStep(
                        tool="deploy_backend",
                        parameters={"project": matched_project, "environment": matched_env, "component": "backend"},
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
                        parameters={"environment": matched_env},
                        description="Post-deployment verification and SLA health check"
                    )
                ]
            )

        # Single Deploy Frontend
        if "deploy" in m and "frontend" in m:
            return ToolRequest(
                tool="deploy_frontend",
                parameters={"project": matched_project, "environment": matched_env, "component": "frontend"},
                requires_confirmation=True,
                confidence=0.95
            )

        # Single Deploy Backend
        if "deploy" in m and ("backend" in m or "api" in m):
            return ToolRequest(
                tool="deploy_backend",
                parameters={"project": matched_project, "environment": matched_env, "component": "backend"},
                requires_confirmation=True,
                confidence=0.95
            )

        # Docker Status
        if "docker" in m or "container" in m or "status" in m or "ps" in m:
            return ToolRequest(
                tool="docker_status",
                parameters={"project": matched_project, "environment": matched_env},
                requires_confirmation=False,
                confidence=0.95
            )

        # Health Check
        if "health" in m or "ping" in m or "check" in m:
            return ToolRequest(
                tool="server_health_check",
                parameters={"environment": matched_env},
                requires_confirmation=False,
                confidence=0.95
            )

        # Restart Container
        if "restart" in m:
            c_name = f"{matched_project}-backend"
            return ToolRequest(
                tool="restart_container",
                parameters={"container_name": c_name},
                requires_confirmation=True,
                confidence=0.90
            )

        # Default fallback to server health check
        return ToolRequest(
            tool="server_health_check",
            parameters={"environment": matched_env},
            requires_confirmation=False,
            confidence=0.80
        )


multi_llm = MultiLLMClient()
