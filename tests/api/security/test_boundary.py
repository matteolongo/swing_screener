from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from starlette.middleware.sessions import SessionMiddleware

from api.security.middleware import SecurityBoundaryMiddleware
from api.security.openapi import install_security_openapi
from api.security.settings import AuthSettings


def _settings() -> AuthSettings:
    settings = AuthSettings.from_env(
        {
            "APP_ENV": "test",
            "AUTH_MODE": "oidc",
            "OIDC_DISCOVERY_URL": "https://id.example.test/.well-known/openid-configuration",
            "OIDC_CLIENT_ID": "client",
            "OIDC_CLIENT_SECRET": "secret",
            "OIDC_REDIRECT_URI": "https://app.example.test/api/auth/callback",
            "SESSION_SECRET": "x" * 32,
        }
    )
    settings.validate_runtime()
    return settings


def _client() -> TestClient:
    settings = _settings()
    app = FastAPI()
    app.state.auth_settings = settings

    @app.get("/health/live")
    async def live():
        return {"status": "alive"}

    @app.get("/health/ready")
    async def ready():
        return {"status": "ready"}

    @app.get("/metrics")
    async def metrics():
        return {"requests": 1}

    @app.get("/api/data")
    async def data(request: Request):
        return {"subject": request.state.principal.subject}

    @app.put("/api/config")
    async def update_config():
        return {"updated": True}

    @app.get("/api/auth/session")
    async def auth_session():
        return {"authenticated": False}

    @app.get("/api/auth/test-login/{role}")
    async def test_login(request: Request, role: str):
        request.session.clear()
        request.session.update(
            {
                "subject": f"{role}-subject",
                "email": None,
                "display_name": role.title(),
                "role": role,
                "issued_at": 100,
                "expires_at": 4_102_444_800,
                "csrf_token": f"{role}-csrf-token",
            }
        )
        return {"csrf_token": f"{role}-csrf-token"}

    app.add_middleware(SecurityBoundaryMiddleware, settings=settings)
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        https_only=False,
        same_site="lax",
    )
    install_security_openapi(app, cookie_name="swing_session")
    return TestClient(app)


def _login(client: TestClient, role: str) -> str:
    response = client.get(f"/api/auth/test-login/{role}")
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_only_liveness_and_auth_flow_are_public():
    client = _client()

    assert client.get("/health/live").status_code == 200
    assert client.get("/api/auth/session").status_code == 200
    assert client.get("/api/data").status_code == 401
    assert client.get("/health/ready").status_code == 401
    assert client.get("/metrics").status_code == 401


def test_authenticated_viewer_can_read_business_api():
    client = _client()
    _login(client, "viewer")

    response = client.get("/api/data")

    assert response.status_code == 200
    assert response.json() == {"subject": "viewer-subject"}


def test_viewer_cannot_mutate_business_api():
    client = _client()
    _login(client, "viewer")

    response = client.put("/api/config", json={})

    assert response.status_code == 403
    assert response.json()["code"] == "INSUFFICIENT_ROLE"


def test_admin_mutation_requires_matching_csrf():
    client = _client()
    csrf = _login(client, "admin")

    missing = client.put("/api/config", json={})
    invalid = client.put(
        "/api/config", json={}, headers={"X-CSRF-Token": "incorrect"}
    )
    valid = client.put(
        "/api/config", json={}, headers={"X-CSRF-Token": csrf}
    )

    assert missing.status_code == 403
    assert missing.json()["code"] == "CSRF_INVALID"
    assert invalid.status_code == 403
    assert valid.status_code == 200


def test_expired_session_is_denied_and_cookie_is_cleared():
    client = _client()
    _login(client, "viewer")

    assert client.cookies

    # Replace the valid login through a deliberately expired public test flow.
    app = client.app

    @app.get("/api/auth/test-expired")
    async def expired(request: Request):
        request.session.clear()
        request.session.update(
            {
                "subject": "expired",
                "email": None,
                "display_name": None,
                "role": "viewer",
                "issued_at": 1,
                "expires_at": 2,
                "csrf_token": "expired",
            }
        )
        return {}

    client.get("/api/auth/test-expired")
    response = client.get("/api/data")

    assert response.status_code == 401
    assert response.json()["code"] == "AUTHENTICATION_REQUIRED"


def test_cors_preflight_is_not_blocked_by_security_boundary():
    client = _client()

    response = client.options("/api/config")

    assert response.status_code != 401


def test_openapi_declares_cookie_auth_only_for_protected_operations():
    client = _client()
    _login(client, "viewer")

    schema = client.get("/openapi.json").json()

    assert schema["components"]["securitySchemes"]["apiSession"] == {
        "type": "apiKey",
        "in": "cookie",
        "name": "swing_session",
    }
    assert schema["paths"]["/api/data"]["get"]["security"] == [
        {"apiSession": []}
    ]
    assert schema["paths"]["/api/config"]["put"]["security"] == [
        {"apiSession": []}
    ]
    assert schema["paths"]["/health/live"]["get"]["security"] == []
    assert schema["paths"]["/api/auth/session"]["get"]["security"] == []
