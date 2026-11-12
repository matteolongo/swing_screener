from __future__ import annotations

import pytest
from sqlalchemy import text

from api.db.readiness import (
    DatabaseSchemaError,
    check_database_readiness,
    require_database_schema_at_head,
)


def test_readiness_requires_connectivity_and_head_revision(runtime):
    ready = check_database_readiness(runtime)
    assert ready.healthy is True
    assert ready.checks == {"connectivity": "ok", "migration": "ok"}


def test_readiness_rejects_stale_migration(runtime):
    with runtime.engine.begin() as connection:
        connection.execute(text("UPDATE alembic_version SET version_num = 'stale'"))

    result = check_database_readiness(runtime)

    assert result.healthy is False
    assert result.checks["connectivity"] == "ok"
    assert result.checks["migration"] == "stale"
    assert (
        result.details["migration"]
        == "Database schema is not at the expected revision."
    )
    with pytest.raises(DatabaseSchemaError, match="expected revision"):
        require_database_schema_at_head(runtime)
