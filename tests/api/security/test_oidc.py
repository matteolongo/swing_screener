from __future__ import annotations

from collections.abc import Mapping

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request
from starlette.responses import RedirectResponse, Response

from api.routers.auth import get_oidc_client, router as auth_router
from api.security.context import (
    establish_session,
    principal_from_session,
    resolve_role,
)
from api.security.models import Principal
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
        "OIDC_ROLE_CLAIM": "roles",
        "OIDC_ADMIN_VALUES": "admin,ops",
        "OIDC_VIEWER_VALUES": "viewer,readonly",
    }
    env.update(updates)
    settings = AuthSettings.from_env(env)
    settings.validate_runtime()
    return settings


def _request(session: dict | None = None) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [],
            "query_string": b"",
            "session": session or {},
        }
    )


def test_admin_claim_takes_precedence_over_viewer():
    assert resolve_role({"roles": ["viewer", "admin"]}, _settings()) == "admin"


def test_role_claim_supports_scalar_and_case_normalization():
    assert resolve_role({"roles": " ReadOnly "}, _settings()) == "viewer"
    assert resolve_role({"roles": ["OPS"]}, _settings()) == "admin"


def test_unknown_or_malformed_role_claim_is_denied():
    assert resolve_role({"roles": ["unknown"]}, _settings()) is None
    assert resolve_role({"roles": {"admin": True}}, _settings()) is None


def test_establish_session_discards_pre_auth_values_and_rotates_csrf():
    request = _request({"state": "old", "nonce": "old", "csrf_token": "old"})

    csrf = establish_session(
        request,
        Principal("sub-1", None, None, "viewer"),
        _settings(),
        now=100,
    )

    assert request.session == {
        "subject": "sub-1",
        "email": None,
        "display_name": None,
        "role": "viewer",
        "issued_at": 100,
        "expires_at": 100 + _settings().session_ttl_seconds,
        "csrf_token": csrf,
    }
    assert csrf != "old"
    assert len(csrf) >= 32


def test_valid_session_resolves_principal():
    request = _request(
        {
            "subject": "sub-1",
            "email": "user@example.test",
            "display_name": "Example User",
            "role": "admin",
            "issued_at": 100,
            "expires_at": 200,
            "csrf_token": "token",
        }
    )

    principal = principal_from_session(request, _settings(), now=150)

    assert principal == Principal(
        "sub-1", "user@example.test", "Example User", "admin"
    )


def test_expired_session_is_cleared():
    request = _request(
        {
            "subject": "sub-1",
            "email": None,
            "display_name": None,
            "role": "viewer",
            "issued_at": 100,
            "expires_at": 150,
            "csrf_token": "token",
        }
    )

    assert principal_from_session(request, _settings(), now=150) is None
    assert request.session == {}


def test_malformed_sessions_are_cleared():
    malformed = [
        {"subject": "", "role": "admin", "issued_at": 1, "expires_at": 2},
        {"subject": "sub", "role": "owner", "issued_at": 1, "expires_at": 2},
        {"subject": "sub", "role": "admin", "issued_at": True, "expires_at": 2},
        {"subject": "sub", "role": "admin", "issued_at": 1, "expires_at": "2"},
        {"subject": "sub", "role": "admin", "issued_at": 2, "expires_at": 1},
    ]

    for value in malformed:
        request = _request(value)
        assert principal_from_session(request, _settings(), now=1) is None
        assert request.session == {}


def test_disabled_mode_resolves_local_admin_without_session():
    settings = AuthSettings.from_env({"APP_ENV": "test", "AUTH_MODE": "disabled"})

    assert principal_from_session(_request(), settings, now=100) == Principal(
        subject="local-development",
        email=None,
        display_name="Local Development",
        role="admin",
    )


class _FakeOIDCClient:
    def __init__(self) -> None:
        self.claims: Mapping[str, object] = {
            "sub": "u-1",
            "email": "u@example.test",
            "name": "Example User",
            "roles": ["viewer"],
        }
        self.failure: Exception | None = None
        self.login_nonce: str | None = None
        self.callback_nonce: str | None = None

    async def authorization_redirect(
        self, request: Request, redirect_uri: str, nonce: str
    ) -> Response:
        self.login_nonce = nonce
        return RedirectResponse(
            f"https://id.example.test/authorize?redirect_uri={redirect_uri}",
            status_code=302,
        )

    async def authorize_access_token(
        self, request: Request, nonce: str
    ) -> Mapping[str, object]:
        self.callback_nonce = nonce
        if self.failure:
            raise self.failure
        return self.claims


def _auth_client(
    settings: AuthSettings | None = None,
) -> tuple[TestClient, _FakeOIDCClient]:
    selected = settings or _settings()
    fake = _FakeOIDCClient()
    app = FastAPI()
    app.state.auth_settings = selected
    app.include_router(auth_router, prefix="/api/auth")
    app.add_middleware(
        SessionMiddleware,
        secret_key=selected.session_secret,
        https_only=False,
        same_site="lax",
    )
    app.dependency_overrides[get_oidc_client] = lambda: fake
    return TestClient(app), fake


def test_login_creates_nonce_and_redirects_to_provider():
    client, fake = _auth_client()

    response = client.get("/api/auth/login", follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"].startswith("https://id.example.test/")
    assert fake.login_nonce is not None
    assert len(fake.login_nonce) >= 32


def test_callback_establishes_minimal_application_session():
    client, fake = _auth_client(
        _settings(OIDC_POST_LOGIN_REDIRECT_URI="http://localhost:5173/")
    )
    client.get("/api/auth/login", follow_redirects=False)

    response = client.get("/api/auth/callback?code=x&state=y", follow_redirects=False)
    session = client.get("/api/auth/session")

    assert response.status_code == 303
    assert response.headers["location"] == "http://localhost:5173/"
    assert fake.callback_nonce == fake.login_nonce
    assert session.status_code == 200
    assert session.json()["authenticated"] is True
    assert session.json()["user"] == {
        "subject": "u-1",
        "email": "u@example.test",
        "display_name": "Example User",
    }
    assert session.json()["role"] == "viewer"
    assert len(session.json()["csrf_token"]) >= 32
    assert session.json()["expires_at"] > session.json()["issued_at"]
    assert "access_token" not in session.text


def test_callback_denies_identity_without_allowed_role():
    client, fake = _auth_client()
    fake.claims = {"sub": "u-1", "roles": ["unknown"]}
    client.get("/api/auth/login", follow_redirects=False)

    response = client.get("/api/auth/callback?code=x&state=y")

    assert response.status_code == 403
    assert response.json()["code"] == "OIDC_ROLE_DENIED"
    assert client.get("/api/auth/session").json() == {"authenticated": False}


def test_callback_rejects_missing_nonce_or_subject():
    client, _ = _auth_client()
    response = client.get("/api/auth/callback?code=x&state=y")
    assert response.status_code == 401
    assert response.json()["code"] == "OIDC_FLOW_INVALID"

    client, fake = _auth_client()
    fake.claims = {"roles": ["viewer"]}
    client.get("/api/auth/login", follow_redirects=False)
    response = client.get("/api/auth/callback?code=x&state=y")
    assert response.status_code == 401
    assert response.json()["code"] == "OIDC_IDENTITY_INVALID"


def test_provider_failure_is_sanitized_and_creates_no_session():
    client, fake = _auth_client()
    fake.failure = RuntimeError("provider response contained secret-token")
    client.get("/api/auth/login", follow_redirects=False)

    response = client.get("/api/auth/callback?code=x&state=y")

    assert response.status_code == 401
    assert response.json()["code"] == "OIDC_AUTHENTICATION_FAILED"
    assert "secret-token" not in response.text
    assert client.get("/api/auth/session").json() == {"authenticated": False}


def test_logout_clears_session():
    client, _ = _auth_client()
    client.get("/api/auth/login", follow_redirects=False)
    client.get("/api/auth/callback?code=x&state=y", follow_redirects=False)

    response = client.post("/api/auth/logout")

    assert response.status_code == 204
    assert client.get("/api/auth/session").json() == {"authenticated": False}


def test_disabled_mode_session_bootstraps_local_admin():
    settings = AuthSettings.from_env({"APP_ENV": "test", "AUTH_MODE": "disabled"})
    client, _ = _auth_client(settings)

    response = client.get("/api/auth/session")

    assert response.json() == {
        "authenticated": True,
        "user": {
            "subject": "local-development",
            "email": None,
            "display_name": "Local Development",
        },
        "role": "admin",
        "csrf_token": None,
        "issued_at": None,
        "expires_at": None,
    }
