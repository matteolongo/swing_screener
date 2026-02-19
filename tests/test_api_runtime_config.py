"""Tests for API runtime environment configuration."""
from __future__ import annotations

from api.runtime_config import (
    DEFAULT_CORS_HEADERS,
    DEFAULT_CORS_METHODS,
    DEFAULT_CORS_ORIGINS,
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

    cfg = load_runtime_config()

    assert cfg.host == "0.0.0.0"
    assert cfg.port == 8000
    assert cfg.reload is True
    assert cfg.cors_allowed_origins == DEFAULT_CORS_ORIGINS
    assert cfg.cors_allowed_methods == DEFAULT_CORS_METHODS
    assert cfg.cors_allowed_headers == DEFAULT_CORS_HEADERS


def test_runtime_config_custom_values(monkeypatch):
    """Runtime config should parse explicitly configured values."""
    monkeypatch.setenv("API_HOST", "127.0.0.1")
    monkeypatch.setenv("PORT", "9000")
    monkeypatch.setenv("API_RELOAD", "false")
    monkeypatch.setenv("API_CORS_ALLOWED_ORIGINS", "https://app.example.com,https://staging.example.com")
    monkeypatch.setenv("API_CORS_ALLOWED_METHODS", "GET,POST")
    monkeypatch.setenv("API_CORS_ALLOWED_HEADERS", "Content-Type,Authorization")

    cfg = load_runtime_config()

    assert cfg.host == "127.0.0.1"
    assert cfg.port == 9000
    assert cfg.reload is False
    assert cfg.cors_allowed_origins == ("https://app.example.com", "https://staging.example.com")
    assert cfg.cors_allowed_methods == ("GET", "POST")
    assert cfg.cors_allowed_headers == ("Content-Type", "Authorization")


def test_runtime_config_invalid_port_falls_back(monkeypatch):
    """Invalid PORT values should not break startup configuration."""
    monkeypatch.setenv("PORT", "not-a-number")

    cfg = load_runtime_config()

    assert cfg.port == 8000

