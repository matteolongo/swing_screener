from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from starlette.middleware.sessions import SessionMiddleware

from api.security.middleware import RateLimitMiddleware, SecurityBoundaryMiddleware
from api.security.rate_limit import FixedWindowRateLimiter, rate_policy
from api.security.settings import AuthSettings


def _settings(**updates: str) -> AuthSettings:
    env = {
        "APP_ENV": "test",
        "AUTH_MODE": "oidc",
        "OIDC_DISCOVERY_URL": "https://id.example.test/.well-known/openid-configuration",
        "OIDC_CLIENT_ID": "client",
        "OIDC_CLIENT_SECRET": "secret",
        "OIDC_REDIRECT_URI": "https://app.example.test/api/auth/callback",
        "SESSION_SECRET": "x" * 32,
        "RATE_LIMIT_DEFAULT_PER_MINUTE": "2",
        "RATE_LIMIT_MUTATION_PER_MINUTE": "2",
        "RATE_LIMIT_EXPENSIVE_PER_MINUTE": "2",
        "RATE_LIMIT_SWEEP_PER_MINUTE": "1",
    }
    env.update(updates)
    return AuthSettings.from_env(env)


def test_fixed_window_allows_limit_then_recovers_at_boundary():
    limiter = FixedWindowRateLimiter(max_buckets=10, window_seconds=60)

    first = limiter.check("sub:a", limit=2, now=100)
    second = limiter.check("sub:a", limit=2, now=159.9)
    denied = limiter.check("sub:a", limit=2, now=159.9)
    recovered = limiter.check("sub:a", limit=2, now=160)

    assert (first.allowed, first.remaining) == (True, 1)
    assert (second.allowed, second.remaining) == (True, 0)
    assert denied.allowed is False
    assert denied.retry_after_seconds == 1
    assert (recovered.allowed, recovered.remaining) == (True, 1)


def test_limiter_keeps_subjects_independent_and_cleans_expired_buckets():
    limiter = FixedWindowRateLimiter(max_buckets=2, window_seconds=60)

    assert limiter.check("sub:a", 1, now=0).allowed
    assert limiter.check("sub:b", 1, now=0).allowed
    assert not limiter.check("sub:a", 1, now=1).allowed
    assert limiter.check("sub:c", 1, now=60).allowed


def test_full_active_store_denies_new_key_without_evicting_active_subject():
    limiter = FixedWindowRateLimiter(max_buckets=1, window_seconds=60)

    assert limiter.check("sub:a", 2, now=0).allowed
    capacity = limiter.check("sub:b", 2, now=1)
    existing = limiter.check("sub:a", 2, now=1)

    assert capacity.allowed is False
    assert capacity.retry_after_seconds == 59
    assert existing.allowed is True


def test_route_policy_uses_most_specific_limit():
    settings = _settings(
        RATE_LIMIT_DEFAULT_PER_MINUTE="120",
        RATE_LIMIT_MUTATION_PER_MINUTE="60",
        RATE_LIMIT_EXPENSIVE_PER_MINUTE="5",
        RATE_LIMIT_SWEEP_PER_MINUTE="2",
    )

    assert rate_policy("/api/intelligence/sweep", "POST", settings) == 2
    assert rate_policy("/api/screener/run", "POST", settings) == 5
    assert rate_policy("/api/config", "PUT", settings) == 60
    assert rate_policy("/api/config", "GET", settings) == 120


def _client(*, trust_proxy: bool = False) -> TestClient:
    settings = _settings(
        AUTH_TRUST_PROXY_HEADERS="true" if trust_proxy else "false"
    )
    limiter = FixedWindowRateLimiter(max_buckets=100, window_seconds=60)
    app = FastAPI()

    @app.get("/api/auth/ping")
    async def ping(request: Request):
        return {"client": request.client.host if request.client else None}

    @app.get("/api/auth/test-login/{subject}")
    async def login(request: Request, subject: str):
        request.session.clear()
        request.session.update(
            {
                "subject": subject,
                "email": None,
                "display_name": None,
                "role": "viewer",
                "issued_at": 1,
                "expires_at": 4_102_444_800,
                "csrf_token": "csrf",
            }
        )
        return {}

    @app.get("/api/data")
    async def data():
        return {"ok": True}

    app.add_middleware(RateLimitMiddleware, settings=settings, limiter=limiter)
    app.add_middleware(SecurityBoundaryMiddleware, settings=settings)
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        https_only=False,
        same_site="lax",
    )
    return TestClient(app)


def test_endpoint_limit_returns_retry_after_and_keys_by_subject():
    first = _client()
    first.get("/api/auth/test-login/user-a")
    assert first.get("/api/data").status_code == 200
    assert first.get("/api/data").status_code == 200
    denied = first.get("/api/data")

    second = _client()
    second.get("/api/auth/test-login/user-b")
    allowed = second.get("/api/data")

    assert denied.status_code == 429
    assert int(denied.headers["Retry-After"]) >= 1
    assert denied.json()["code"] == "RATE_LIMIT_EXCEEDED"
    assert allowed.status_code == 200


def test_forwarded_address_is_ignored_unless_proxy_trust_is_enabled():
    direct = _client(trust_proxy=False)
    headers_a = {"X-Forwarded-For": "198.51.100.10"}
    headers_b = {"X-Forwarded-For": "198.51.100.11"}

    assert direct.get("/api/auth/ping", headers=headers_a).status_code == 200
    assert direct.get("/api/auth/ping", headers=headers_a).status_code == 200
    assert direct.get("/api/auth/ping", headers=headers_b).status_code == 429

    trusted = _client(trust_proxy=True)
    assert trusted.get("/api/auth/ping", headers=headers_a).status_code == 200
    assert trusted.get("/api/auth/ping", headers=headers_a).status_code == 200
    assert trusted.get("/api/auth/ping", headers=headers_b).status_code == 200


def test_explicit_disabled_mode_bypasses_request_limiting():
    settings = AuthSettings.from_env({"APP_ENV": "test", "AUTH_MODE": "disabled"})
    limiter = FixedWindowRateLimiter(max_buckets=1, window_seconds=60)
    app = FastAPI()

    @app.get("/api/data")
    async def data():
        return {"ok": True}

    app.add_middleware(RateLimitMiddleware, settings=settings, limiter=limiter)
    client = TestClient(app)

    assert all(client.get("/api/data").status_code == 200 for _ in range(130))
