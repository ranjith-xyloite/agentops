from prometheus_client import (
    Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST,
    CollectorRegistry, REGISTRY
)

# Standard HTTP metrics
HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests received",
    ["method", "endpoint", "status_code"]
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

# AgentOps Domain metrics
AGENTOPS_TASKS_TOTAL = Counter(
    "agentops_tasks_total",
    "Total agent tasks processed",
    ["tool", "status"]
)

ACTIVE_SSE_SUBSCRIBERS = Gauge(
    "agentops_active_sse_subscribers",
    "Number of active SSE log stream connections"
)

DB_POOL_ACTIVE_CONNECTIONS = Gauge(
    "agentops_db_pool_active_connections",
    "Number of checked-out database connections"
)

SYSTEM_UPTIME_SECONDS = Gauge(
    "agentops_uptime_seconds",
    "System uptime in seconds"
)


def get_prometheus_metrics() -> bytes:
    """Generate Prometheus metric output formatted for scraper."""
    return generate_latest(REGISTRY)
