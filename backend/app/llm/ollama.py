import json
import httpx
from typing import Dict, Any
from app.llm.base import LLMClient
from app.schemas import ToolRequest
from app.config import settings

SYSTEM_PROMPT = r"""
You are a strict parser assistant for AgentOps. Always and only respond with JSON matching the ToolRequest schema.
Valid keys: tool, parameters (object), requires_confirmation (bool), confidence (float), missing_information (array), question (string).
If you cannot produce a tool selection, return tool=null and include missing_information and a question field.
Never produce shell commands. Never invent new tools. Only pick from allowed_tools provided in the context.
"""

class OllamaClient(LLMClient):
    async def parse(self, user_message: str, context: Dict[str, Any]) -> ToolRequest:
        # Build a safe prompt that includes allowed tools and projects
        payload = {
            "model": settings.OLLAMA_MODEL,
            "prompt": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Context: {json.dumps(context)}\nUser: {user_message}\nRespond with JSON only."}
            ],
            "max_length": 1024
        }
        if not settings.OLLAMA_BASE_URL:
            # fallback: very conservative parser (mock)
            return self._mock_parse(user_message)

        url = f"{settings.OLLAMA_BASE_URL}/api/generate"
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            text = r.text
        # Attempt to extract JSON from response
        try:
            data = json.loads(text)
        except Exception:
            # try to find first JSON object in text
            import re
            m = re.search(r"\{.*\}", text, re.S)
            if m:
                try:
                    data = json.loads(m.group(0))
                except Exception as e:
                    raise ValueError("LLM returned non-JSON and fallback failed")
            else:
                raise ValueError("LLM returned non-JSON")
        return ToolRequest(**data)

    def _mock_parse(self, user_message: str) -> ToolRequest:
        # Extremely small heuristic parser for Phase 1
        msg = user_message.lower()
        out = {"tool": None, "parameters": {}, "requires_confirmation": False, "confidence": 0.5}
        if "deploy" in msg and "frontend" in msg:
            out.update({"tool": "deploy_frontend", "parameters": {"project": "mom", "component": "frontend"}, "requires_confirmation": True, "confidence": 0.9})
            # find branch
            for token in ["qa", "dev", "main", "master", "staging"]:
                if token in msg:
                    out["parameters"]["branch"] = token
                    break
            for env in ["uat", "production", "prod", "qa", "staging"]:
                if env in msg:
                    out["parameters"]["environment"] = "uat" if env=="uat" else ("production" if env in ("production","prod") else env)
                    break
        elif "docker" in msg and "status" in msg:
            out.update({"tool": "docker_status", "parameters": {}, "requires_confirmation": False, "confidence": 0.8})
        return ToolRequest(**out)
