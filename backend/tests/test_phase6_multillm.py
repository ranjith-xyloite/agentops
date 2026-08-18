import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.llm.multillm import multi_llm


@pytest.mark.asyncio
async def test_multillm_configuration_and_status(admin_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Get LLM status
        res = await client.get("/api/system/llm", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert "active_provider" in data
        assert "available_providers" in data

        # Configure LLM provider
        conf_payload = {
            "provider": "ollama",
            "model_name": "qwen3"
        }
        post_res = await client.post("/api/system/llm", headers=admin_headers, json=conf_payload)
        assert post_res.status_code == 200
        assert post_res.json()["status"] == "configured"


@pytest.mark.asyncio
async def test_multillm_heuristic_dag_parsing():
    # Pipeline query should parse into multi-step DAG
    context = {"projects": ["agentops"], "environments": ["production"]}
    plan = await multi_llm.parse("Execute full deployment pipeline for agentops on production", context)
    assert plan.steps is not None
    assert len(plan.steps) >= 3
    assert plan.requires_confirmation is True


@pytest.mark.asyncio
async def test_multillm_opensource_providers_with_api_key(admin_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test configuring Groq with API key
        groq_payload = {
            "provider": "groq",
            "model_name": "llama-3.3-70b-versatile",
            "api_key": "gsk_test_mock_key_123"
        }
        res = await client.post("/api/system/llm", headers=admin_headers, json=groq_payload)
        assert res.status_code == 200
        assert res.json()["status"] == "configured"
        assert res.json()["provider"] == "groq"

        # Verify status reflect active Groq provider and model
        status_res = await client.get("/api/system/llm", headers=admin_headers)
        assert status_res.status_code == 200
        data = status_res.json()
        assert data["active_provider"] == "groq"
        assert data["active_model"] == "llama-3.3-70b-versatile"
        assert "api.groq.com" in data["active_base_url"]

        # Test configuring custom OpenAI-compatible endpoint with custom Base URL
        custom_payload = {
            "provider": "openai_compatible",
            "model_name": "meta-llama/llama-3.3-70b-instruct",
            "api_key": "sk-custom-api-key",
            "base_url": "https://openrouter.ai/api/v1"
        }
        res2 = await client.post("/api/system/llm", headers=admin_headers, json=custom_payload)
        assert res2.status_code == 200
        assert res2.json()["base_url"] == "https://openrouter.ai/api/v1"

