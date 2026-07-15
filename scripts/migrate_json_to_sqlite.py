#!/usr/bin/env python
"""Validate or execute the legacy portfolio import."""

from __future__ import annotations

import argparse
from pathlib import Path

from api.db.import_legacy import classify_import_state, import_legacy_portfolio
from api.db.session import create_database_runtime
from api.db.settings import get_database_settings
from api.db.unit_of_work import PortfolioUnitOfWork


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", default=get_database_settings().url)
    parser.add_argument("--orders", type=Path, default=Path("data/orders.json"))
    parser.add_argument("--positions", type=Path, default=Path("data/positions.json"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    runtime = create_database_runtime(args.database_url)

    def factory() -> PortfolioUnitOfWork:
        return PortfolioUnitOfWork(runtime.session_factory)

    try:
        if args.dry_run:
            with factory() as uow:
                print(f"state={classify_import_state(uow.session).value}")
            return
        report = import_legacy_portfolio(
            factory, args.orders, args.positions, "20260715_0001"
        )
        print(
            f"state={report.state.value} imported={report.imported} "
            f"orders={report.order_count} positions={report.position_count}"
        )
    finally:
        runtime.engine.dispose()


if __name__ == "__main__":
    main()
