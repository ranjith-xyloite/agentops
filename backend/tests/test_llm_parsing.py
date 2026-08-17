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

@pytest.mark.asyncio
async def test_mock_parse_deploy_backend():
    client = OllamaClient()
    parsed = await client.parse("Deploy MOM backend main branch to production", context={})
    assert parsed.tool == "deploy_backend"
    assert parsed.parameters.get("component") == "backend"
    assert parsed.requires_confirmation is True

@pytest.mark.asyncio
async def test_mock_parse_restart_container():
    client = OllamaClient()
    parsed = await client.parse("Restart container on UAT", context={})
    assert parsed.tool == "restart_container"
    assert parsed.requires_confirmation is True

@pytest.mark.asyncio
async def test_mock_parse_health_check():
    client = OllamaClient()
    parsed = await client.parse("Health check on production servers", context={})
    assert parsed.tool == "server_health_check"
    assert parsed.requires_confirmation is False
