"""Tests for API runtime environment configuration."""
from __future__ import annotations

from api.runtime_config import (
    DEFAULT_CORS_HEADERS,
    DEFAULT_CORS_METHODS,
    DEFAULT_CORS_ORIGINS,
    DEFAULT_AUTH_MODE,
    DEFAULT_JWT_EXPIRE_MINUTES,
    DEFAULT_MEMBERSHIPS_CSV_PATH,
    DEFAULT_USERS_CSV_PATH,
    load_runtime_config,
)


def test_runtime_config_defaults(monkeypatch):
    """Runtime config should fall back to sane local defaults."""
    monkeypatch.delenv("API_HOST", raising=False)
    monkeypatch.delenv("PORT", raising=False)
    monkeypatch.delenv("API_RELOAD", raising=False)
    monkeypatch.delenv("API_CORS_ALLOWED_ORIGINS", raising=False)
    monkeypatch.delenv("API_CORS_ALLOWED_METHODS", raising=False)
    monkeypatch.delenv("API_CORS_ALLOWED_HEADERS", raising=False)
    monkeypatch.delenv("API_AUTH_ENABLED", raising=False)
    monkeypatch.delenv("API_AUTH_MODE", raising=False)
    monkeypatch.delenv("API_AUTH_USERS_CSV_PATH", raising=False)
    monkeypatch.delenv("API_AUTH_MEMBERSHIPS_CSV_PATH", raising=False)
    monkeypatch.delenv("API_AUTH_JWT_SECRET", raising=False)
    monkeypatch.delenv("API_AUTH_JWT_EXPIRE_MINUTES", raising=False)
    monkeypatch.delenv("API_AUTH_MANAGED_PROVIDER", raising=False)
    monkeypatch.delenv("API_AUTH_MANAGED_JWT_SECRET", raising=False)
    monkeypatch.delenv("API_AUTH_MANAGED_SUBJECT_CLAIM", raising=False)
    monkeypatch.delenv("API_AUTH_MANAGED_EMAIL_CLAIM", raising=False)
    monkeypatch.delenv("API_AUTH_MANAGED_TENANT_CLAIM", raising=False)
    monkeypatch.delenv("API_AUTH_MANAGED_ROLE_CLAIM", raising=False)
    monkeypatch.delenv("API_AUTH_MANAGED_ACTIVE_CLAIM", raising=False)

    cfg = load_runtime_config()

    assert cfg.host == "0.0.0.0"
    assert cfg.port == 8000
    assert cfg.reload is True
    assert cfg.cors_allowed_origins == DEFAULT_CORS_ORIGINS
    assert cfg.cors_allowed_methods == DEFAULT_CORS_METHODS
    assert cfg.cors_allowed_headers == DEFAULT_CORS_HEADERS
    assert cfg.auth_enabled is False
    assert cfg.auth_mode == DEFAULT_AUTH_MODE
    assert cfg.auth_users_csv_path == DEFAULT_USERS_CSV_PATH
    assert cfg.auth_memberships_csv_path == DEFAULT_MEMBERSHIPS_CSV_PATH
    assert cfg.auth_jwt_secret == "dev-only-insecure-secret"
    assert cfg.auth_jwt_expire_minutes == DEFAULT_JWT_EXPIRE_MINUTES
    assert cfg.auth_managed_provider == "oidc"
    assert cfg.auth_managed_jwt_secret == "managed-dev-secret"
    assert cfg.auth_managed_subject_claim == "sub"
    assert cfg.auth_managed_email_claim == "email"
    assert cfg.auth_managed_tenant_claim == "tenant_id"
    assert cfg.auth_managed_role_claim == "role"
    assert cfg.auth_managed_active_claim == "active"


def test_runtime_config_custom_values(monkeypatch):
    """Runtime config should parse explicitly configured values."""
    monkeypatch.setenv("API_HOST", "127.0.0.1")
    monkeypatch.setenv("PORT", "9000")
    monkeypatch.setenv("API_RELOAD", "false")
    monkeypatch.setenv("API_CORS_ALLOWED_ORIGINS", "https://app.example.com,https://staging.example.com")
    monkeypatch.setenv("API_CORS_ALLOWED_METHODS", "GET,POST")
    monkeypatch.setenv("API_CORS_ALLOWED_HEADERS", "Content-Type,Authorization")
    monkeypatch.setenv("API_AUTH_ENABLED", "true")
    monkeypatch.setenv("API_AUTH_MODE", "managed")
    monkeypatch.setenv("API_AUTH_USERS_CSV_PATH", "config/users.csv")
    monkeypatch.setenv("API_AUTH_MEMBERSHIPS_CSV_PATH", "config/tenant_memberships.csv")
    monkeypatch.setenv("API_AUTH_JWT_SECRET", "super-secret")
    monkeypatch.setenv("API_AUTH_JWT_EXPIRE_MINUTES", "90")
    monkeypatch.setenv("API_AUTH_MANAGED_PROVIDER", "custom-provider")
    monkeypatch.setenv("API_AUTH_MANAGED_JWT_SECRET", "provider-secret")
    monkeypatch.setenv("API_AUTH_MANAGED_SUBJECT_CLAIM", "oid")
    monkeypatch.setenv("API_AUTH_MANAGED_EMAIL_CLAIM", "upn")
    monkeypatch.setenv("API_AUTH_MANAGED_TENANT_CLAIM", "tenant")
    monkeypatch.setenv("API_AUTH_MANAGED_ROLE_CLAIM", "app_role")
    monkeypatch.setenv("API_AUTH_MANAGED_ACTIVE_CLAIM", "enabled")

    cfg = load_runtime_config()

    assert cfg.host == "127.0.0.1"
    assert cfg.port == 9000
    assert cfg.reload is False
    assert cfg.cors_allowed_origins == ("https://app.example.com", "https://staging.example.com")
    assert cfg.cors_allowed_methods == ("GET", "POST")
    assert cfg.cors_allowed_headers == ("Content-Type", "Authorization")
    assert cfg.auth_enabled is True
    assert cfg.auth_mode == "managed"
    assert cfg.auth_users_csv_path == "config/users.csv"
    assert cfg.auth_memberships_csv_path == "config/tenant_memberships.csv"
    assert cfg.auth_jwt_secret == "super-secret"
    assert cfg.auth_jwt_expire_minutes == 90
    assert cfg.auth_managed_provider == "custom-provider"
    assert cfg.auth_managed_jwt_secret == "provider-secret"
    assert cfg.auth_managed_subject_claim == "oid"
    assert cfg.auth_managed_email_claim == "upn"
    assert cfg.auth_managed_tenant_claim == "tenant"
    assert cfg.auth_managed_role_claim == "app_role"
    assert cfg.auth_managed_active_claim == "enabled"


def test_runtime_config_invalid_port_falls_back(monkeypatch):
    """Invalid PORT values should not break startup configuration."""
    monkeypatch.setenv("PORT", "not-a-number")

    cfg = load_runtime_config()

    assert cfg.port == 8000


def test_runtime_config_invalid_auth_mode_falls_back(monkeypatch):
    monkeypatch.setenv("API_AUTH_MODE", "unknown")
    cfg = load_runtime_config()
    assert cfg.auth_mode == DEFAULT_AUTH_MODE
