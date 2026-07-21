"""Typed, fail-closed security configuration."""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
import hashlib
from os import environ as process_environ
from typing import Literal, Mapping

AppEnvironment = Literal["development", "test", "production"]
AuthMode = Literal["disabled", "oidc"]


class SecurityConfigurationError(RuntimeError):
    """Raised when the security environment is invalid."""


def _enum(env: Mapping[str, str], name: str, default: str, allowed: set[str]) -> str:
    value = env.get(name, default).strip().lower()
    if value not in allowed:
        choices = ", ".join(sorted(allowed))
        raise SecurityConfigurationError(f"{name} must be one of: {choices}")
    return value


def _boolean(env: Mapping[str, str], name: str, default: bool) -> bool:
    raw = env.get(name)
    if raw is None or not raw.strip():
        return default
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    raise SecurityConfigurationError(f"{name} must be a boolean")


def _positive_int(
    env: Mapping[str, str], name: str, default: int, *, maximum: int | None = None
) -> int:
    raw = env.get(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise SecurityConfigurationError(f"{name} must be an integer") from exc
    if value <= 0 or (maximum is not None and value > maximum):
        suffix = f" between 1 and {maximum}" if maximum is not None else " positive"
        raise SecurityConfigurationError(f"{name} must be{suffix}")
    return value


def _values(env: Mapping[str, str], name: str, default: str) -> frozenset[str]:
    return frozenset(
        part.strip().lower()
        for part in env.get(name, default).split(",")
        if part.strip()
    )


@dataclass(frozen=True)
class AuthSettings:
    app_env: AppEnvironment
    auth_mode: AuthMode
    oidc_discovery_url: str
    oidc_client_id: str
    oidc_client_secret: str = field(repr=False)
    oidc_redirect_uri: str
    oidc_post_login_redirect_uri: str
    oidc_role_claim: str
    oidc_admin_values: frozenset[str]
    oidc_viewer_values: frozenset[str]
    session_secret: str = field(repr=False)
    session_ttl_seconds: int
    session_cookie_name: str
    session_cookie_secure: bool
    api_docs_enabled: bool
    trust_proxy_headers: bool
    rate_limit_default_per_minute: int
    rate_limit_mutation_per_minute: int
    rate_limit_expensive_per_minute: int
    rate_limit_sweep_per_minute: int
    rate_limit_max_buckets: int
    intelligence_sweep_max_symbols: int
    order_approval_signing_key: bytes = field(repr=False)
    order_approval_ttl_seconds: int = 28_800

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "AuthSettings":
        env = process_environ if environ is None else environ
        app_env = _enum(
            env, "APP_ENV", "development", {"development", "test", "production"}
        )
        auth_default = "oidc" if app_env == "production" else "disabled"
        auth_mode = _enum(env, "AUTH_MODE", auth_default, {"disabled", "oidc"})
        default_secret = (
            "development-only-session-secret-change-me"
            if auth_mode == "disabled"
            else ""
        )
        session_secret = env.get("SESSION_SECRET", default_secret)
        raw_approval_key = env.get("ORDER_APPROVAL_SIGNING_KEY", "")
        approval_key = raw_approval_key.encode("utf-8")
        if not approval_key and app_env != "production":
            approval_key = hashlib.sha256(
                f"order-approval:{session_secret}".encode("utf-8")
            ).digest()
        return cls(
            app_env=app_env,  # type: ignore[arg-type]
            auth_mode=auth_mode,  # type: ignore[arg-type]
            oidc_discovery_url=env.get("OIDC_DISCOVERY_URL", "").strip(),
            oidc_client_id=env.get("OIDC_CLIENT_ID", "").strip(),
            oidc_client_secret=env.get("OIDC_CLIENT_SECRET", "").strip(),
            oidc_redirect_uri=env.get("OIDC_REDIRECT_URI", "").strip(),
            oidc_post_login_redirect_uri=env.get(
                "OIDC_POST_LOGIN_REDIRECT_URI", "/"
            ).strip()
            or "/",
            oidc_role_claim=env.get("OIDC_ROLE_CLAIM", "roles").strip(),
            oidc_admin_values=_values(env, "OIDC_ADMIN_VALUES", "admin"),
            oidc_viewer_values=_values(env, "OIDC_VIEWER_VALUES", "viewer"),
            session_secret=session_secret,
            session_ttl_seconds=_positive_int(env, "SESSION_TTL_SECONDS", 8 * 60 * 60),
            session_cookie_name=env.get("SESSION_COOKIE_NAME", "swing_session").strip(),
            session_cookie_secure=_boolean(
                env, "SESSION_COOKIE_SECURE", app_env == "production"
            ),
            api_docs_enabled=_boolean(env, "API_DOCS_ENABLED", app_env != "production"),
            trust_proxy_headers=_boolean(env, "AUTH_TRUST_PROXY_HEADERS", False),
            rate_limit_default_per_minute=_positive_int(
                env, "RATE_LIMIT_DEFAULT_PER_MINUTE", 120
            ),
            rate_limit_mutation_per_minute=_positive_int(
                env, "RATE_LIMIT_MUTATION_PER_MINUTE", 60
            ),
            rate_limit_expensive_per_minute=_positive_int(
                env, "RATE_LIMIT_EXPENSIVE_PER_MINUTE", 5
            ),
            rate_limit_sweep_per_minute=_positive_int(
                env, "RATE_LIMIT_SWEEP_PER_MINUTE", 2
            ),
            rate_limit_max_buckets=_positive_int(env, "RATE_LIMIT_MAX_BUCKETS", 10_000),
            intelligence_sweep_max_symbols=_positive_int(
                env, "INTELLIGENCE_SWEEP_MAX_SYMBOLS", 20, maximum=100
            ),
            order_approval_signing_key=approval_key,
            order_approval_ttl_seconds=_positive_int(
                env, "ORDER_APPROVAL_TTL_SECONDS", 28_800
            ),
        )

    def validate_runtime(self) -> None:
        if not self.oidc_role_claim:
            raise SecurityConfigurationError("OIDC_ROLE_CLAIM must not be empty")
        if not self.session_cookie_name:
            raise SecurityConfigurationError("SESSION_COOKIE_NAME must not be empty")
        if not self.oidc_admin_values:
            raise SecurityConfigurationError("OIDC_ADMIN_VALUES must not be empty")
        if not self.oidc_viewer_values:
            raise SecurityConfigurationError("OIDC_VIEWER_VALUES must not be empty")
        if self.app_env == "production" and self.auth_mode == "disabled":
            raise SecurityConfigurationError(
                "AUTH_MODE=disabled is not permitted in production"
            )
        if self.auth_mode == "oidc":
            required = {
                "OIDC_DISCOVERY_URL": self.oidc_discovery_url,
                "OIDC_CLIENT_ID": self.oidc_client_id,
                "OIDC_CLIENT_SECRET": self.oidc_client_secret,
                "OIDC_REDIRECT_URI": self.oidc_redirect_uri,
                "SESSION_SECRET": self.session_secret,
            }
            for name, value in required.items():
                if not value:
                    raise SecurityConfigurationError(f"{name} is required in OIDC mode")
        if self.app_env == "production":
            if len(self.session_secret.encode("utf-8")) < 32:
                raise SecurityConfigurationError(
                    "SESSION_SECRET must contain at least 32 bytes in production"
                )
            if not self.session_cookie_secure:
                raise SecurityConfigurationError(
                    "SESSION_COOKIE_SECURE must be enabled in production"
                )
            if len(self.order_approval_signing_key) < 32:
                raise SecurityConfigurationError(
                    "ORDER_APPROVAL_SIGNING_KEY must contain at least 32 bytes in production"
                )
            if self.order_approval_ttl_seconds > 86_400:
                raise SecurityConfigurationError(
                    "ORDER_APPROVAL_TTL_SECONDS must not exceed 86400 in production"
                )


@lru_cache(maxsize=1)
def get_auth_settings() -> AuthSettings:
    settings = AuthSettings.from_env()
    settings.validate_runtime()
    return settings


def reset_auth_settings_cache() -> None:
    get_auth_settings.cache_clear()
