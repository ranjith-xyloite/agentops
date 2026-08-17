import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database.session import check_db_health


@pytest.mark.asyncio
async def test_correlation_id_and_security_headers():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Request without correlation ID -> Server generates one
        res = await client.get("/api/health")
        assert res.status_code == 200
        assert "x-request-id" in res.headers
        assert "x-correlation-id" in res.headers
        assert res.headers["x-content-type-options"] == "nosniff"
        assert res.headers["x-frame-options"] == "DENY"

        # Request with custom correlation ID -> Server preserves it
        custom_id = "test-trace-id-12345"
        res_custom = await client.get("/api/health", headers={"X-Request-ID": custom_id})
        assert res_custom.status_code == 200
        assert res_custom.headers["x-request-id"] == custom_id


@pytest.mark.asyncio
async def test_k8s_liveness_and_readiness_probes():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Liveness probe
        res_live = await client.get("/api/health/live")
        assert res_live.status_code == 200
        assert res_live.json()["status"] == "alive"

        # Readiness probe
        res_ready = await client.get("/api/health/ready")
        assert res_ready.status_code == 200
        data = res_ready.json()
        assert data["status"] == "ready"
        assert data["database"]["status"] == "healthy"


@pytest.mark.asyncio
async def test_prometheus_metrics_scraping():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/metrics")
        assert res.status_code == 200
        text = res.text
        assert "http_requests_total" in text
        assert "http_request_duration_seconds" in text


@pytest.mark.asyncio
async def test_system_observability_endpoint(operator_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/system/observability", headers=operator_headers)
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "database" in data
        assert "metrics" in data
        assert "k8s_probes" in data


@pytest.mark.asyncio
async def test_database_health_check():
    health = await check_db_health()
    assert health["status"] == "healthy"
    assert "latency_ms" in health
