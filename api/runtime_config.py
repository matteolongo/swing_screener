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
DEFAULT_USERS_CSV_PATH = "data/users.csv"
DEFAULT_MEMBERSHIPS_CSV_PATH = "data/tenant_memberships.csv"
DEFAULT_JWT_EXPIRE_MINUTES = 480
DEFAULT_AUTH_MODE = "csv"


@dataclass(frozen=True)
class ApiRuntimeConfig:
    host: str
    port: int
    reload: bool
    cors_allowed_origins: tuple[str, ...]
    cors_allowed_methods: tuple[str, ...]
    cors_allowed_headers: tuple[str, ...]
    auth_enabled: bool
    auth_mode: str
    auth_users_csv_path: str
    auth_memberships_csv_path: str
    auth_jwt_secret: str
    auth_jwt_expire_minutes: int
    auth_managed_provider: str
    auth_managed_jwt_secret: str
    auth_managed_subject_claim: str
    auth_managed_email_claim: str
    auth_managed_tenant_claim: str
    auth_managed_role_claim: str
    auth_managed_active_claim: str


def _parse_auth_mode(var_name: str, default: str = DEFAULT_AUTH_MODE) -> str:
    raw = os.getenv(var_name, default).strip().lower()
    if raw in {"csv", "managed"}:
        return raw
    return default


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


def _parse_int_env(var_name: str, default: int, minimum: int | None = None) -> int:
    raw = os.getenv(var_name)
    if raw is None or not raw.strip():
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    if minimum is not None and value < minimum:
        return default
    return value


def load_runtime_config() -> ApiRuntimeConfig:
    """Load API runtime settings from environment variables."""
    return ApiRuntimeConfig(
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=_parse_port_env("PORT", default=8000),
        reload=_parse_bool_env("API_RELOAD", default=True),
        cors_allowed_origins=_parse_csv_env("API_CORS_ALLOWED_ORIGINS", DEFAULT_CORS_ORIGINS),
        cors_allowed_methods=_parse_csv_env("API_CORS_ALLOWED_METHODS", DEFAULT_CORS_METHODS),
        cors_allowed_headers=_parse_csv_env("API_CORS_ALLOWED_HEADERS", DEFAULT_CORS_HEADERS),
        auth_enabled=_parse_bool_env("API_AUTH_ENABLED", default=False),
        auth_mode=_parse_auth_mode("API_AUTH_MODE", default=DEFAULT_AUTH_MODE),
        auth_users_csv_path=os.getenv("API_AUTH_USERS_CSV_PATH", DEFAULT_USERS_CSV_PATH),
        auth_memberships_csv_path=os.getenv("API_AUTH_MEMBERSHIPS_CSV_PATH", DEFAULT_MEMBERSHIPS_CSV_PATH),
        auth_jwt_secret=os.getenv("API_AUTH_JWT_SECRET", "dev-only-insecure-secret"),
        auth_jwt_expire_minutes=_parse_int_env(
            "API_AUTH_JWT_EXPIRE_MINUTES",
            default=DEFAULT_JWT_EXPIRE_MINUTES,
            minimum=1,
        ),
        auth_managed_provider=os.getenv("API_AUTH_MANAGED_PROVIDER", "oidc"),
        auth_managed_jwt_secret=os.getenv("API_AUTH_MANAGED_JWT_SECRET", "managed-dev-secret"),
        auth_managed_subject_claim=os.getenv("API_AUTH_MANAGED_SUBJECT_CLAIM", "sub"),
        auth_managed_email_claim=os.getenv("API_AUTH_MANAGED_EMAIL_CLAIM", "email"),
        auth_managed_tenant_claim=os.getenv("API_AUTH_MANAGED_TENANT_CLAIM", "tenant_id"),
        auth_managed_role_claim=os.getenv("API_AUTH_MANAGED_ROLE_CLAIM", "role"),
        auth_managed_active_claim=os.getenv("API_AUTH_MANAGED_ACTIVE_CLAIM", "active"),
    )
