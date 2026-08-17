import os
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./agentops.db"
    LLM_PROVIDER: str = "ollama"
    OLLAMA_BASE_URL: Optional[AnyHttpUrl] = None
    OLLAMA_MODEL: str = "qwen3"
    SECRET_KEY: str = "agentops_jwt_secret_key_32_bytes_super_secure_2026_phase4"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000

    model_config = {
        "env_file": [".env", "../.env", "../../.env"],
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }


settings = Settings()
