#!/usr/bin/env python
"""Validate or execute the legacy portfolio import."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from alembic.config import Config  # noqa: E402
from alembic.runtime.migration import MigrationContext  # noqa: E402
from alembic.script import ScriptDirectory  # noqa: E402

from api.db.import_legacy import (  # noqa: E402
    LEGACY_IMPORT_SCHEMA_REVISION,
    classify_import_state,
    import_legacy_portfolio,
    validate_legacy_sources,
)
from api.db.session import create_database_runtime  # noqa: E402
from api.db.settings import get_database_settings, normalize_database_url  # noqa: E402
from api.db.unit_of_work import PortfolioUnitOfWork  # noqa: E402


def _require_alembic_head(runtime) -> None:
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    expected = ScriptDirectory.from_config(config).get_current_head()
    with runtime.engine.connect() as connection:
        current = MigrationContext.configure(connection).get_current_revision()
    if current != expected:
        raise RuntimeError(
            "Database schema is not at Alembic head; run 'alembic upgrade head' first"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", default=get_database_settings().url)
    parser.add_argument("--orders", type=Path, default=Path("data/orders.json"))
    parser.add_argument("--positions", type=Path, default=Path("data/positions.json"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    runtime = create_database_runtime(normalize_database_url(args.database_url))

    def factory() -> PortfolioUnitOfWork:
        return PortfolioUnitOfWork(runtime.session_factory)

    try:
        _require_alembic_head(runtime)
        if args.dry_run:
            with factory() as uow:
                state = classify_import_state(uow.session)
            sources = validate_legacy_sources(args.orders, args.positions)
            print(
                f"state={state.value} orders={sources.order_count} "
                f"positions={sources.position_count} "
                f"orders_sha256={sources.orders_sha256} "
                f"positions_sha256={sources.positions_sha256}"
            )
            return
        report = import_legacy_portfolio(
            factory, args.orders, args.positions, LEGACY_IMPORT_SCHEMA_REVISION
        )
        print(
            f"state={report.state.value} imported={report.imported} "
            f"orders={report.order_count} positions={report.position_count}"
        )
    finally:
        runtime.engine.dispose()


if __name__ == "__main__":
    main()
