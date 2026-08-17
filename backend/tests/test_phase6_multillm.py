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
