"""Sanitized readiness checks for transactional portfolio persistence."""

from __future__ import annotations

from dataclasses import dataclass, field
import logging
from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import text

from api.db.import_legacy import classify_import_state
from api.db.session import DatabaseRuntime

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DatabaseReadiness:
    healthy: bool
    checks: dict[str, str]
    details: dict[str, str] = field(default_factory=dict)


class DatabaseSchemaError(RuntimeError):
    """Raised before import when the database is unavailable or not at head."""


def _expected_revision() -> str:
    root = Path(__file__).resolve().parents[2]
    config = Config(str(root / "alembic.ini"))
    revision = ScriptDirectory.from_config(config).get_current_head()
    if revision is None:
        raise RuntimeError("Alembic has no head revision")
    return revision


def require_database_schema_at_head(runtime: DatabaseRuntime) -> None:
    try:
        with runtime.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            current_revision = MigrationContext.configure(
                connection
            ).get_current_revision()
        expected_revision = _expected_revision()
    except Exception:
        raise DatabaseSchemaError("Database schema could not be validated.") from None
    if current_revision != expected_revision:
        raise DatabaseSchemaError("Database schema is not at the expected revision.")


def check_database_readiness(runtime: DatabaseRuntime) -> DatabaseReadiness:
    checks = {
        "connectivity": "error",
        "migration": "unknown",
        "legacy_import": "unknown",
    }
    details: dict[str, str] = {}

    try:
        with runtime.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            checks["connectivity"] = "ok"
            current_revision = MigrationContext.configure(
                connection
            ).get_current_revision()
    except Exception as exc:
        logger.warning(
            "Database readiness connectivity check failed: exception=%s",
            type(exc).__name__,
        )
        details["connectivity"] = "Database is unavailable."
        return DatabaseReadiness(False, checks, details)

    try:
        expected_revision = _expected_revision()
    except Exception as exc:
        logger.error(
            "Database readiness migration metadata failed: exception=%s",
            type(exc).__name__,
        )
        checks["migration"] = "error"
        details["migration"] = "Migration metadata is unavailable."
        return DatabaseReadiness(False, checks, details)

    if current_revision != expected_revision:
        checks["migration"] = "stale"
        details["migration"] = "Database schema is not at the expected revision."
        logger.warning(
            "Database readiness revision mismatch: current=%s expected=%s",
            current_revision or "none",
            expected_revision,
        )
        return DatabaseReadiness(False, checks, details)
    checks["migration"] = "ok"

    try:
        with runtime.session_factory() as session:
            state = classify_import_state(session)
    except Exception as exc:
        logger.warning(
            "Database readiness import-state check failed: exception=%s",
            type(exc).__name__,
        )
        checks["legacy_import"] = "error"
        details["legacy_import"] = "Legacy import state is unavailable."
        return DatabaseReadiness(False, checks, details)

    checks["legacy_import"] = state.value
    if state.value != "complete":
        details["legacy_import"] = "Legacy portfolio import is not complete."
        return DatabaseReadiness(False, checks, details)
    return DatabaseReadiness(True, checks, details)
