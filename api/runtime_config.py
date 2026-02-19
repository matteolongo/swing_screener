"""Runtime configuration helpers for API process settings."""
from __future__ import annotations

import os
from dataclasses import dataclass

DEFAULT_CORS_ORIGINS = ("http://localhost:5173", "http://localhost:5174")
DEFAULT_CORS_METHODS = ("GET", "POST", "PUT", "DELETE", "PATCH")
DEFAULT_CORS_HEADERS = (
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "User-Agent",
    "X-Requested-With",
)


@dataclass(frozen=True)
class ApiRuntimeConfig:
    host: str
    port: int
    reload: bool
    cors_allowed_origins: tuple[str, ...]
    cors_allowed_methods: tuple[str, ...]
    cors_allowed_headers: tuple[str, ...]


def _parse_csv_env(var_name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw = os.getenv(var_name, "")
    if not raw.strip():
        return default

    values = tuple(item.strip() for item in raw.split(",") if item.strip())
    return values or default


def _parse_bool_env(var_name: str, default: bool) -> bool:
    raw = os.getenv(var_name)
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _parse_port_env(var_name: str, default: int) -> int:
    raw = os.getenv(var_name)
    if raw is None or not raw.strip():
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if 1 <= value <= 65535 else default


def load_runtime_config() -> ApiRuntimeConfig:
    """Load API runtime settings from environment variables."""
    return ApiRuntimeConfig(
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=_parse_port_env("PORT", default=8000),
        reload=_parse_bool_env("API_RELOAD", default=True),
        cors_allowed_origins=_parse_csv_env("API_CORS_ALLOWED_ORIGINS", DEFAULT_CORS_ORIGINS),
        cors_allowed_methods=_parse_csv_env("API_CORS_ALLOWED_METHODS", DEFAULT_CORS_METHODS),
        cors_allowed_headers=_parse_csv_env("API_CORS_ALLOWED_HEADERS", DEFAULT_CORS_HEADERS),
    )

