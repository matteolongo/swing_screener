"""Authentication, role, and CSRF boundary for the HTTP API."""
from __future__ import annotations

import hmac

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from api.security.context import principal_from_session
from api.security.rate_limit import FixedWindowRateLimiter, rate_policy
from api.security.settings import AuthSettings

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
PUBLIC_EXACT = frozenset({"/", "/api/auth/session", "/health/live", "/favicon.ico"})
PUBLIC_PREFIXES = ("/api/auth/", "/assets/")


def is_public_path(path: str) -> bool:
    return path in PUBLIC_EXACT or path.startswith(PUBLIC_PREFIXES)


def is_protected_path(path: str) -> bool:
    return (
        path == "/api"
        or path.startswith("/api/")
        or path in {"/health", "/health/ready", "/metrics", "/docs", "/redoc", "/openapi.json"}
    ) and not is_public_path(path)


def _error(status_code: int, detail: str, code: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"detail": detail, "code": code},
    )


class SecurityBoundaryMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, settings: AuthSettings) -> None:  # noqa: ANN001
        super().__init__(app)
        self._settings = settings

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path
        if request.method == "OPTIONS" or not is_protected_path(path):
            return await call_next(request)

        principal = principal_from_session(request, self._settings)
        if principal is None:
            return _error(
                401,
                "Authentication is required.",
                "AUTHENTICATION_REQUIRED",
            )
        request.state.principal = principal

        if request.method not in SAFE_METHODS:
            if principal.role != "admin":
                return _error(
                    403,
                    "Administrator access is required.",
                    "INSUFFICIENT_ROLE",
                )
            if self._settings.auth_mode == "oidc":
                expected = request.session.get("csrf_token")
                supplied = request.headers.get("X-CSRF-Token")
                if (
                    not isinstance(expected, str)
                    or not isinstance(supplied, str)
                    or not hmac.compare_digest(expected, supplied)
                ):
                    return _error(403, "The CSRF token is invalid.", "CSRF_INVALID")

        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        *,
        settings: AuthSettings,
        limiter: FixedWindowRateLimiter | None = None,
    ) -> None:  # noqa: ANN001
        super().__init__(app)
        self._settings = settings
        self._limiter = limiter or FixedWindowRateLimiter(
            max_buckets=settings.rate_limit_max_buckets
        )

    def _key(self, request: Request) -> str:
        principal = getattr(request.state, "principal", None)
        if principal is not None:
            return f"sub:{principal.subject}"
        host = request.client.host if request.client else "unknown"
        if self._settings.trust_proxy_headers:
            forwarded = request.headers.get("X-Forwarded-For", "")
            candidate = forwarded.split(",", 1)[0].strip()
            if candidate:
                host = candidate
        return f"ip:{host}"

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if (
            self._settings.auth_mode == "disabled"
            or request.method == "OPTIONS"
            or request.url.path.startswith("/assets/")
        ):
            return await call_next(request)
        limit = rate_policy(request.url.path, request.method, self._settings)
        decision = self._limiter.check(self._key(request), limit)
        if not decision.allowed:
            response = _error(
                429,
                "The request rate limit was exceeded.",
                "RATE_LIMIT_EXCEEDED",
            )
            response.headers["Retry-After"] = str(decision.retry_after_seconds)
            response.headers["X-RateLimit-Remaining"] = "0"
            return response
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(decision.remaining)
        return response
