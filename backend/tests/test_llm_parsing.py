import asyncio
from app.llm.ollama import OllamaClient

import pytest

@pytest.mark.asyncio
async def test_mock_parse_deploy_frontend():
    client = OllamaClient()
    parsed = await client.parse("Deploy MOM frontend QA branch to UAT", context={})
    assert parsed.tool == "deploy_frontend"
    assert parsed.parameters.get("component") == "frontend"
    assert parsed.requires_confirmation is True

@pytest.mark.asyncio
async def test_mock_parse_docker_status():
    client = OllamaClient()
    parsed = await client.parse("Check Docker containers on UAT", context={})
    assert parsed.tool == "docker_status" or parsed.tool is None
