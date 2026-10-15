#!/usr/bin/env python
"""Preview or apply local linked-exit reconciliation for the SQL ledger."""

from __future__ import annotations

# ruff: noqa: E402

import argparse
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from alembic.config import Config  # noqa: E402
from alembic.runtime.migration import MigrationContext  # noqa: E402
from alembic.script import ScriptDirectory  # noqa: E402

from api.db.session import create_database_runtime  # noqa: E402
from api.db.settings import get_database_settings, normalize_database_url  # noqa: E402
from api.db.unit_of_work import PortfolioUnitOfWork  # noqa: E402
from api.services.portfolio.linked_exits import (
    reconcile_linked_exit_records,
)  # noqa: E402
from swing_screener.errors import ConflictError  # noqa: E402


@dataclass(frozen=True)
class ReconciliationPlan:
    position_id: str
    updates: tuple[tuple[str, dict[str, object]], ...]
    skipped_reason: str | None = None


def build_reconciliation_plans(
    positions: Sequence[Mapping[str, object]],
    orders: Sequence[Mapping[str, object]],
) -> list[ReconciliationPlan]:
    """Return only the local-order updates that reconciliation would perform."""
    original_by_id = {str(order.get("order_id")): order for order in orders}
    position_ids = {
        str(position.get("position_id") or "")
        for position in positions
        if position.get("position_id")
    }
    plans: list[ReconciliationPlan] = []
    for position in positions:
        position_id = str(position.get("position_id") or "")
        if not position_id:
            continue
        try:
            desired = reconcile_linked_exit_records(position, orders)
        except ConflictError as exc:
            plans.append(
                ReconciliationPlan(
                    position_id=position_id,
                    updates=(),
                    skipped_reason=str(exc),
                )
            )
            continue

        updates: list[tuple[str, dict[str, object]]] = []
        for order in desired:
            order_id = str(order.get("order_id") or "")
            original = original_by_id.get(order_id)
            if original is None:
                continue
            changed = {
                key: value
                for key, value in order.items()
                if key not in {"order_id", "version"} and original.get(key) != value
            }
            if changed:
                updates.append((order_id, changed))
        if updates:
            plans.append(
                ReconciliationPlan(position_id=position_id, updates=tuple(updates))
            )

    for order in orders:
        position_id = str(order.get("position_id") or "")
        if (
            str(order.get("status") or "") not in {"pending", "submitted"}
            or str(order.get("order_kind") or "") not in {"stop", "take_profit"}
            or position_id in position_ids
        ):
            continue
        order_id = str(order.get("order_id") or "<unknown>")
        plans.append(
            ReconciliationPlan(
                position_id=position_id or "<missing-position-id>",
                updates=(),
                skipped_reason=(
                    "Active linked protective order has no position: " f"{order_id}"
                ),
            )
        )
    return plans


def _require_alembic_head(runtime) -> None:
    config = Config(str(PROJECT_ROOT / "alembic.ini"))
    expected = ScriptDirectory.from_config(config).get_current_head()
    with runtime.engine.connect() as connection:
        current = MigrationContext.configure(connection).get_current_revision()
    if current != expected:
        raise RuntimeError(
            "Database schema is not at Alembic head; run 'alembic upgrade head' first"
        )


def _print_plans(plans: Sequence[ReconciliationPlan], *, prefix: str) -> None:
    proposed = sum(len(plan.updates) for plan in plans)
    skipped = sum(plan.skipped_reason is not None for plan in plans)
    print(f"{prefix} proposed_updates={proposed} skipped_positions={skipped}")
    for plan in plans:
        if plan.skipped_reason:
            print(f"position={plan.position_id} skipped={plan.skipped_reason}")
            continue
        for order_id, updates in plan.updates:
            print(f"position={plan.position_id} order={order_id} updates={updates}")


def _apply_position_plan(
    uow: PortfolioUnitOfWork, position_id: str
) -> ReconciliationPlan | None:
    uow.begin_write()
    uow.lock_portfolio_state()
    position = uow.positions.get_position(position_id, for_update=True)
    if position is None:
        return None
    orders, _ = uow.orders.list_orders()
    plans = build_reconciliation_plans(
        [position],
        [order for order in orders if order.get("position_id") == position_id],
    )
    if not plans:
        return None
    plan = plans[0]
    if plan.skipped_reason:
        return plan
    for order_id, updates in plan.updates:
        if uow.orders.update_order(order_id, updates) is None:
            raise RuntimeError(f"Linked order not found: {order_id}")
    return plan


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", default=get_database_settings().url)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply each proposed position reconciliation in its own transaction.",
    )
    args = parser.parse_args()

    runtime = create_database_runtime(normalize_database_url(args.database_url))
    try:
        _require_alembic_head(runtime)

        def factory() -> PortfolioUnitOfWork:
            return PortfolioUnitOfWork(runtime.session_factory)

        with factory() as uow:
            positions, _ = uow.positions.list_positions()
            orders, _ = uow.orders.list_orders()
        plans = build_reconciliation_plans(positions, orders)
        _print_plans(plans, prefix="dry-run")
        if not args.apply:
            return 0

        applied: list[ReconciliationPlan] = []
        for plan in plans:
            if plan.skipped_reason:
                continue
            with factory() as uow:
                refreshed = _apply_position_plan(uow, plan.position_id)
            if refreshed is not None:
                applied.append(refreshed)
        _print_plans(applied, prefix="applied")
        return 0
    finally:
        runtime.engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
