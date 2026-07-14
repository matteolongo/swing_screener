from __future__ import annotations

from starlette.requests import Request

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
