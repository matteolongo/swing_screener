from __future__ import annotations

import pytest

from api.security.settings import AuthSettings, SecurityConfigurationError


def test_production_defaults_to_oidc_and_requires_complete_configuration():
    settings = AuthSettings.from_env({"APP_ENV": "production"})

    assert settings.auth_mode == "oidc"
    with pytest.raises(SecurityConfigurationError, match="OIDC_DISCOVERY_URL"):
        settings.validate_runtime()


def test_disabled_auth_is_rejected_in_production():
    settings = AuthSettings.from_env(
        {"APP_ENV": "production", "AUTH_MODE": "disabled"}
    )

    with pytest.raises(SecurityConfigurationError, match="disabled"):
        settings.validate_runtime()


def test_test_mode_allows_disabled_auth_and_resolves_limits():
    settings = AuthSettings.from_env({"APP_ENV": "test", "AUTH_MODE": "disabled"})

    settings.validate_runtime()

    assert settings.session_cookie_secure is False
    assert settings.rate_limit_max_buckets == 10_000
    assert settings.intelligence_sweep_max_symbols == 20


@pytest.mark.parametrize(
    ("name", "value"),
    [("APP_ENV", "staging"), ("AUTH_MODE", "basic")],
)
def test_invalid_enum_values_are_rejected(name: str, value: str):
    env = {"APP_ENV": "test", "AUTH_MODE": "disabled", name: value}

    with pytest.raises(SecurityConfigurationError, match=name):
        AuthSettings.from_env(env)


def test_production_requires_long_session_secret_after_oidc_fields():
    settings = AuthSettings.from_env(
        {
            "APP_ENV": "production",
            "OIDC_DISCOVERY_URL": "https://id.example.test/.well-known/openid-configuration",
            "OIDC_CLIENT_ID": "client",
            "OIDC_CLIENT_SECRET": "provider-secret",
            "OIDC_REDIRECT_URI": "https://app.example.test/api/auth/callback",
            "SESSION_SECRET": "short",
        }
    )

    with pytest.raises(SecurityConfigurationError, match="SESSION_SECRET"):
        settings.validate_runtime()


def test_production_rejects_insecure_session_cookie():
    settings = AuthSettings.from_env(
        {
            "APP_ENV": "production",
            "OIDC_DISCOVERY_URL": "https://id.example.test/.well-known/openid-configuration",
            "OIDC_CLIENT_ID": "client",
            "OIDC_CLIENT_SECRET": "provider-secret",
            "OIDC_REDIRECT_URI": "https://app.example.test/api/auth/callback",
            "SESSION_SECRET": "x" * 32,
            "SESSION_COOKIE_SECURE": "false",
        }
    )

    with pytest.raises(SecurityConfigurationError, match="SESSION_COOKIE_SECURE"):
        settings.validate_runtime()


def test_role_values_are_normalized_and_must_not_be_empty():
    settings = AuthSettings.from_env(
        {
            "APP_ENV": "test",
            "AUTH_MODE": "disabled",
            "OIDC_ADMIN_VALUES": " Admin, OPS,admin ",
            "OIDC_VIEWER_VALUES": " Viewer, ReadOnly ",
        }
    )

    assert settings.oidc_admin_values == frozenset({"admin", "ops"})
    assert settings.oidc_viewer_values == frozenset({"viewer", "readonly"})

    empty = AuthSettings.from_env(
        {
            "APP_ENV": "test",
            "AUTH_MODE": "disabled",
            "OIDC_ADMIN_VALUES": ",",
        }
    )
    with pytest.raises(SecurityConfigurationError, match="OIDC_ADMIN_VALUES"):
        empty.validate_runtime()


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("SESSION_TTL_SECONDS", "0"),
        ("RATE_LIMIT_DEFAULT_PER_MINUTE", "nope"),
        ("RATE_LIMIT_MUTATION_PER_MINUTE", "-1"),
        ("RATE_LIMIT_MAX_BUCKETS", "0"),
        ("INTELLIGENCE_SWEEP_MAX_SYMBOLS", "101"),
    ],
)
def test_invalid_numeric_limits_are_rejected(name: str, value: str):
    with pytest.raises(SecurityConfigurationError, match=name):
        AuthSettings.from_env(
            {"APP_ENV": "test", "AUTH_MODE": "disabled", name: value}
        )


def test_secret_values_are_excluded_from_repr():
    settings = AuthSettings.from_env(
        {
            "APP_ENV": "test",
            "AUTH_MODE": "disabled",
            "SESSION_SECRET": "a-distinct-session-secret-value",
            "OIDC_CLIENT_SECRET": "a-distinct-client-secret-value",
        }
    )

    rendered = repr(settings)
    assert "a-distinct-session-secret-value" not in rendered
    assert "a-distinct-client-secret-value" not in rendered
