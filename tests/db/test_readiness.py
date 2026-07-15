from __future__ import annotations

from pathlib import Path

from sqlalchemy import text

from api.db.import_legacy import import_legacy_portfolio
from api.db.readiness import check_database_readiness
from api.db.unit_of_work import PortfolioUnitOfWork


def _factory(runtime):
    return lambda: PortfolioUnitOfWork(runtime.session_factory)


def test_readiness_requires_connectivity_head_revision_and_complete_import(
    runtime, tmp_path: Path
):
    initial = check_database_readiness(runtime)
    assert initial.healthy is False
    assert initial.checks["connectivity"] == "ok"
    assert initial.checks["migration"] == "ok"
    assert initial.checks["legacy_import"] == "empty"

    import_legacy_portfolio(
        _factory(runtime),
        tmp_path / "missing-orders.json",
        tmp_path / "missing-positions.json",
        "20260715_0001",
    )

    ready = check_database_readiness(runtime)
    assert ready.healthy is True
    assert ready.checks == {
        "connectivity": "ok",
        "migration": "ok",
        "legacy_import": "complete",
    }


def test_readiness_rejects_stale_migration(runtime, tmp_path: Path):
    import_legacy_portfolio(
        _factory(runtime),
        tmp_path / "orders.json",
        tmp_path / "positions.json",
        "20260715_0001",
    )
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
