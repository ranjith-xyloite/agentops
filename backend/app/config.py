from pydantic import BaseSettings, AnyHttpUrl
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str
    LLM_PROVIDER: str = "ollama"
    OLLAMA_BASE_URL: Optional[AnyHttpUrl] = None
    OLLAMA_MODEL: str = "qwen3"
    SECRET_KEY: str = "changeme"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000

    class Config:
        env_file = "../../.env"
        env_file_encoding = "utf-8"

settings = Settings()
