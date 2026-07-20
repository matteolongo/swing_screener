"""Fail-closed database configuration."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from os import environ as process_environ
from typing import Literal, Mapping


class DatabaseConfigurationError(RuntimeError):
    """Raised when database configuration is unsafe or incomplete."""


def _boolean(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


@dataclass(frozen=True)
class DatabaseSettings:
    url: str
    app_env: Literal["development", "test", "production"]
    allow_production_sqlite: bool = False
    database_url_configured: bool = False

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "DatabaseSettings":
        env = process_environ if environ is None else environ
        app_env = str(env.get("APP_ENV", "development")).strip().lower()
        if app_env not in {"development", "test", "production"}:
            raise DatabaseConfigurationError(f"Unsupported APP_ENV: {app_env}")
        configured = str(env.get("DATABASE_URL", "")).strip()
        url = configured or "sqlite:///data/swing_screener.db"
        url = normalize_database_url(url)
        return cls(
            url=url,
            app_env=app_env,  # type: ignore[arg-type]
            allow_production_sqlite=_boolean(env.get("ALLOW_PRODUCTION_SQLITE")),
            database_url_configured=bool(configured),
        )

    def validate_runtime(self) -> None:
        if self.app_env != "production":
            return
        if not self.database_url_configured:
            raise DatabaseConfigurationError("DATABASE_URL is required in production")
        if self.url.startswith("sqlite:") and not self.allow_production_sqlite:
            raise DatabaseConfigurationError(
                "SQLite is disabled in production; set ALLOW_PRODUCTION_SQLITE=true to override"
            )


@lru_cache(maxsize=1)
def get_database_settings() -> DatabaseSettings:
    return DatabaseSettings.from_env()
