from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from sqlalchemy import func, select

from api.db.models import IdempotencyRecordRow, LegacyImportRow
from api.db.unit_of_work import PortfolioUnitOfWork
from api.models.portfolio import ClosePositionRequest, PartialCloseRequest
from api.services.portfolio_service import PortfolioService
from api.services.orders_service import OrdersService
from scripts.reconcile_exit_orders import _apply_position_plan
from swing_screener.errors import ValidationError


def _position() -> dict[str, object]:
    return {
        "position_id": "POS-AAPL-001",
        "ticker": "AAPL",
        "status": "open",
        "shares": 10,
        "entry_date": "2026-10-01",
        "entry_price": 100.0,
        "stop_price": 95.0,
        "initial_risk": 5.0,
        "quote_currency": "USD",
        "account_currency": "EUR",
        "entry_fx_rate": 1.1,
    }


def _stop_order() -> dict[str, object]:
    return {
        "order_id": "ORD-STOP-POS-AAPL-001",
        "ticker": "AAPL",
        "status": "pending",
        "order_type": "SELL_STOP",
        "order_kind": "stop",
        "quantity": 10,
        "stop_price": 95.0,
        "order_date": "2026-10-01",
        "position_id": "POS-AAPL-001",
        "quote_currency": "USD",
        "account_currency": "EUR",
    }


def _seed_ledger(uow):
    uow.begin_write()
    uow.session.add(
        LegacyImportRow(
            id=1,
            schema_revision="test",
            orders_sha256="0" * 64,
            positions_sha256="0" * 64,
            order_count=2,
            position_count=2,
            orders_asof="2026-10-01",
            positions_asof="2026-10-01",
        )
    )


def test_repair_sql_apply_twice_leaves_unrelated_protection_untouched(runtime):
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        _seed_ledger(uow)
        uow.positions.add_position({**_position(), "shares": 5})
        uow.orders.add_order(_stop_order())
        uow.positions.add_position({**_position(), "position_id": "POS-OTHER"})
        uow.orders.add_order(
            {**_stop_order(), "order_id": "ORD-OTHER", "position_id": "POS-OTHER"}
        )

    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        plan = _apply_position_plan(uow, "POS-AAPL-001")
        assert plan is not None
        assert plan.updates == (("ORD-STOP-POS-AAPL-001", {"quantity": 5}),)
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        assert _apply_position_plan(uow, "POS-AAPL-001") is None
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        assert uow.orders.get_order("ORD-STOP-POS-AAPL-001")["quantity"] == 5
        assert uow.orders.get_order("ORD-OTHER")["quantity"] == 10


def test_repair_sql_failure_rolls_back_every_linked_order(runtime, monkeypatch):
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        _seed_ledger(uow)
        uow.positions.add_position({**_position(), "shares": 5})
        uow.orders.add_order(_stop_order())
        uow.orders.add_order(
            {**_stop_order(), "order_id": "ORD-TARGET", "order_kind": "take_profit"}
        )

    with pytest.raises(RuntimeError, match="injected repair failure"):
        with PortfolioUnitOfWork(runtime.session_factory) as uow:
            update_order = uow.orders.update_order

            def update_then_fail(order_id, updates):
                result = update_order(order_id, updates)
                if order_id == "ORD-TARGET":
                    raise RuntimeError("injected repair failure")
                return result

            monkeypatch.setattr(uow.orders, "update_order", update_then_fail)
            _apply_position_plan(uow, "POS-AAPL-001")

    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        assert uow.orders.get_order("ORD-STOP-POS-AAPL-001")["quantity"] == 10
        assert uow.orders.get_order("ORD-TARGET")["quantity"] == 10


def test_concurrent_final_exits_commit_one_close_and_one_receipt(runtime):
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        _seed_ledger(uow)
        uow.positions.add_position(_position())
        uow.orders.add_order(_stop_order())
    start = Barrier(2)

    def close(key):
        start.wait(timeout=5)
        try:
            with PortfolioUnitOfWork(runtime.session_factory) as uow:
                PortfolioService(
                    positions_repo=uow.positions,
                    orders_repo=uow.orders,
                    uow=uow,
                    business_date=lambda: "2026-10-14",
                ).close_position(
                    "POS-AAPL-001",
                    ClosePositionRequest(exit_price=110.0),
                    idempotency_key=key,
                )
            return "closed"
        except ValidationError:
            return "already-closed"

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(close, ["exit-a", "exit-b"]))

    assert sorted(outcomes) == ["already-closed", "closed"]
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        assert uow.positions.get_position("POS-AAPL-001")["status"] == "closed"
        assert uow.orders.get_order("ORD-STOP-POS-AAPL-001")["status"] == "cancelled"
        assert (
            uow.session.scalar(select(func.count()).select_from(IdempotencyRecordRow))
            == 1
        )


def test_exit_and_linked_order_reconciliation_roll_back_together(runtime, monkeypatch):
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        uow.begin_write()
        uow.session.add(
            LegacyImportRow(
                id=1,
                schema_revision="test",
                orders_sha256="0" * 64,
                positions_sha256="0" * 64,
                order_count=1,
                position_count=1,
                orders_asof="2026-10-01",
                positions_asof="2026-10-01",
            )
        )
        uow.positions.add_position(_position())
        uow.orders.add_order(_stop_order())

    with pytest.raises(RuntimeError, match="injected linked-order failure"):
        with PortfolioUnitOfWork(runtime.session_factory) as uow:
            service = PortfolioService(
                positions_repo=uow.positions,
                orders_repo=uow.orders,
                uow=uow,
                business_date=lambda: "2026-10-14",
            )

            def fail_after_position_write(*_args, **_kwargs):
                raise RuntimeError("injected linked-order failure")

            monkeypatch.setattr(uow.orders, "update_order", fail_after_position_write)
            service.close_position(
                "POS-AAPL-001",
                ClosePositionRequest(exit_price=110.0),
                idempotency_key="close-pos-aapl-001",
            )

    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        position = uow.positions.get_position("POS-AAPL-001")
        stop_order = uow.orders.get_order("ORD-STOP-POS-AAPL-001")

    assert position is not None
    assert position["status"] == "open"
    assert stop_order is not None
    assert stop_order["status"] == "pending"


def test_partial_exit_idempotency_replay_does_not_reconcile_twice(runtime):
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        uow.begin_write()
        uow.session.add(
            LegacyImportRow(
                id=1,
                schema_revision="test",
                orders_sha256="0" * 64,
                positions_sha256="0" * 64,
                order_count=1,
                position_count=1,
                orders_asof="2026-10-01",
                positions_asof="2026-10-01",
            )
        )
        uow.positions.add_position(_position())
        uow.orders.add_order(_stop_order())

    partial_close = PartialCloseRequest(shares_closed=5, price=110.0)
    for _ in range(2):
        with PortfolioUnitOfWork(runtime.session_factory) as uow:
            PortfolioService(
                positions_repo=uow.positions,
                orders_repo=uow.orders,
                uow=uow,
                business_date=lambda: "2026-10-14",
            ).partial_close_position(
                "POS-AAPL-001",
                partial_close,
                idempotency_key="partial-close-pos-aapl-001",
            )

    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        position = uow.positions.get_position("POS-AAPL-001")
        stop_order = uow.orders.get_order("ORD-STOP-POS-AAPL-001")

    assert position is not None
    assert position["shares"] == 5
    assert len(position["partial_closes"]) == 1
    assert stop_order is not None
    assert stop_order["quantity"] == 5


@pytest.mark.parametrize("operation", ["submit_order", "cancel_order"])
def test_order_status_changes_lock_the_ledger_before_the_order(
    runtime, monkeypatch, operation
):
    events = []
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        original_operation = getattr(uow.orders, operation)

        def lock_ledger():
            events.append("ledger")

        def update_order(*args, **kwargs):
            events.append("order")
            return original_operation(*args, **kwargs)

        uow.begin_write()
        uow.orders.add_order(_stop_order())
        monkeypatch.setattr(uow, "lock_portfolio_state", lock_ledger)
        monkeypatch.setattr(uow.orders, operation, update_order)
        service = OrdersService(uow.orders, uow.positions, uow=uow)
        getattr(service, operation)("ORD-STOP-POS-AAPL-001")

    assert events == ["ledger", "order"]
