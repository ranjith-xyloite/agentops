from pydantic import BaseModel, Field, Extra
from typing import Optional, List, Any, Dict
from enum import Enum

class ToolRequest(BaseModel):
    tool: Optional[str]
    parameters: Optional[Dict[str, Any]] = {}
    requires_confirmation: Optional[bool] = False
    confidence: Optional[float] = 0.0
    missing_information: Optional[List[str]] = []
    question: Optional[str] = None

    class Config:
        extra = Extra.forbid

class ChatRequest(BaseModel):
    message: str

class ExecutionPlan(BaseModel):
    tool: Optional[str]
    parameters: Dict[str, Any]
    requires_confirmation: bool = False

class TaskOut(BaseModel):
    id: int
    user_request: str
    intent: Optional[str]
    status: str
    requires_confirmation: bool

    class Config:
        orm_mode = True

