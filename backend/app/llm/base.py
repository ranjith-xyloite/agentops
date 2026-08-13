from abc import ABC, abstractmethod
from typing import Any, Dict
from app.schemas import ToolRequest

class LLMClient(ABC):
    @abstractmethod
    async def parse(self, user_message: str, context: Dict[str, Any]) -> ToolRequest:
        """Parse a user message and return a validated ToolRequest (Pydantic)"""
        raise NotImplementedError()
