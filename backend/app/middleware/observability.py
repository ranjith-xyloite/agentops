import time
import uuid
import re
from typing import Dict, List, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

from app.core.logging_config import correlation_id_ctx
from app.core.metrics import HTTP_REQUESTS_TOTAL, HTTP_REQUEST_DURATION_SECONDS


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware that assigns a unique Correlation / Request ID to every incoming request
    and propagates it across logs and response headers.
    """
    async def dispatch(self, request: Request, call_next):
        # Read header or generate new ID
        corr_id = request.headers.get("X-Request-ID") or request.headers.get("X-Correlation-ID")
        if not corr_id:
            corr_id = f"req_{uuid.uuid4().hex[:12]}"

        # Bind to contextvar for structured logger
        token = correlation_id_ctx.set(corr_id)

        try:
            response: Response = await call_next(request)
            response.headers["X-Request-ID"] = corr_id
            response.headers["X-Correlation-ID"] = corr_id
            return response
        finally:
            correlation_id_ctx.reset(token)


class PrometheusMetricsMiddleware(BaseHTTPMiddleware):
    """
    Middleware that records Prometheus request counters and latency histograms.
    """
    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        path = request.url.path

        # Normalize ID paths to avoid Prometheus label cardinality explosion
        normalized_path = re.sub(r'/\d+', '/{id}', path)

        try:
            response: Response = await call_next(request)
            duration = time.perf_counter() - start_time
            
            # Skip recording /metrics itself
            if not path.endswith("/metrics"):
                HTTP_REQUESTS_TOTAL.labels(
                    method=request.method,
                    endpoint=normalized_path,
                    status_code=str(response.status_code)
                ).inc()
                HTTP_REQUEST_DURATION_SECONDS.labels(
                    method=request.method,
                    endpoint=normalized_path
                ).observe(duration)
                
            return response
        except Exception as e:
            duration = time.perf_counter() - start_time
            HTTP_REQUESTS_TOTAL.labels(
                method=request.method,
                endpoint=normalized_path,
                status_code="500"
            ).inc()
            HTTP_REQUEST_DURATION_SECONDS.labels(
                method=request.method,
                endpoint=normalized_path
            ).observe(duration)
            raise e


class RateLimitingMiddleware(BaseHTTPMiddleware):
    """
    In-memory sliding window rate limiter per client IP.
    Enforces stricter limits for authentication endpoints to prevent brute-force attacks.
    """
    def __init__(self, app, general_limit: int = 120, auth_limit: int = 20, window_seconds: int = 60):
        super().__init__(app)
        self.general_limit = general_limit
        self.auth_limit = auth_limit
        self.window_seconds = window_seconds
        # Mapping: ip -> list of request timestamps
        self.requests: Dict[str, List[float]] = {}
        self.auth_requests: Dict[str, List[float]] = {}

    def _clean_and_count(self, req_map: Dict[str, List[float]], key: str, now: float) -> int:
        timestamps = req_map.get(key, [])
        cutoff = now - self.window_seconds
        # Retain only timestamps within the sliding window
        valid_ts = [ts for ts in timestamps if ts > cutoff]
        req_map[key] = valid_ts
        return len(valid_ts)

    async def dispatch(self, request: Request, call_next):
        # Exclude internal health and metrics checks from rate limiting
        path = request.url.path
        if path.startswith("/api/health") or path.endswith("/metrics") or request.method == "OPTIONS":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        # Check Auth specific endpoint limits
        if "/api/auth/login" in path:
            count = self._clean_and_count(self.auth_requests, client_ip, now)
            if count >= self.auth_limit:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many login attempts. Please wait 60 seconds before trying again."},
                    headers={"Retry-After": str(self.window_seconds)}
                )
            self.auth_requests[client_ip].append(now)
        else:
            count = self._clean_and_count(self.requests, client_ip, now)
            if count >= self.general_limit:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "API rate limit exceeded. Please slow down your requests."},
                    headers={"Retry-After": str(self.window_seconds)}
                )
            self.requests[client_ip].append(now)

        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Injects standard enterprise security headers into all responses.
    """
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
