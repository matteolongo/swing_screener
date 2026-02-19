"""Tests for API runtime environment configuration."""
from __future__ import annotations

from api.runtime_config import (
    DEFAULT_CORS_HEADERS,
    DEFAULT_CORS_METHODS,
    DEFAULT_CORS_ORIGINS,
    DEFAULT_JWT_EXPIRE_MINUTES,
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
    monkeypatch.delenv("API_AUTH_USERS_CSV_PATH", raising=False)
    monkeypatch.delenv("API_AUTH_JWT_SECRET", raising=False)
    monkeypatch.delenv("API_AUTH_JWT_EXPIRE_MINUTES", raising=False)

    cfg = load_runtime_config()

    assert cfg.host == "0.0.0.0"
    assert cfg.port == 8000
    assert cfg.reload is True
    assert cfg.cors_allowed_origins == DEFAULT_CORS_ORIGINS
    assert cfg.cors_allowed_methods == DEFAULT_CORS_METHODS
    assert cfg.cors_allowed_headers == DEFAULT_CORS_HEADERS
    assert cfg.auth_enabled is False
    assert cfg.auth_users_csv_path == DEFAULT_USERS_CSV_PATH
    assert cfg.auth_jwt_secret == "dev-only-insecure-secret"
    assert cfg.auth_jwt_expire_minutes == DEFAULT_JWT_EXPIRE_MINUTES


def test_runtime_config_custom_values(monkeypatch):
    """Runtime config should parse explicitly configured values."""
    monkeypatch.setenv("API_HOST", "127.0.0.1")
    monkeypatch.setenv("PORT", "9000")
    monkeypatch.setenv("API_RELOAD", "false")
    monkeypatch.setenv("API_CORS_ALLOWED_ORIGINS", "https://app.example.com,https://staging.example.com")
    monkeypatch.setenv("API_CORS_ALLOWED_METHODS", "GET,POST")
    monkeypatch.setenv("API_CORS_ALLOWED_HEADERS", "Content-Type,Authorization")
    monkeypatch.setenv("API_AUTH_ENABLED", "true")
    monkeypatch.setenv("API_AUTH_USERS_CSV_PATH", "config/users.csv")
    monkeypatch.setenv("API_AUTH_JWT_SECRET", "super-secret")
    monkeypatch.setenv("API_AUTH_JWT_EXPIRE_MINUTES", "90")

    cfg = load_runtime_config()

    assert cfg.host == "127.0.0.1"
    assert cfg.port == 9000
    assert cfg.reload is False
    assert cfg.cors_allowed_origins == ("https://app.example.com", "https://staging.example.com")
    assert cfg.cors_allowed_methods == ("GET", "POST")
    assert cfg.cors_allowed_headers == ("Content-Type", "Authorization")
    assert cfg.auth_enabled is True
    assert cfg.auth_users_csv_path == "config/users.csv"
    assert cfg.auth_jwt_secret == "super-secret"
    assert cfg.auth_jwt_expire_minutes == 90


def test_runtime_config_invalid_port_falls_back(monkeypatch):
    """Invalid PORT values should not break startup configuration."""
    monkeypatch.setenv("PORT", "not-a-number")

    cfg = load_runtime_config()

    assert cfg.port == 8000
