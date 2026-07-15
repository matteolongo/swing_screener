from __future__ import annotations

import pytest

from api.db.unit_of_work import PortfolioUnitOfWork


def _order(order_id="ORD-AAPL-001"):
    return {
        "order_id": order_id,
        "ticker": "AAPL",
        "status": "pending",
        "order_type": "BUY_LIMIT",
        "order_kind": "entry",
        "quantity": 2,
        "limit_price": 100.125,
        "stop_price": 95.25,
        "target_price": 110.5,
        "entry_price": None,
        "order_date": "2026-07-15",
        "filled_date": None,
        "position_id": None,
        "quote_currency": "USD",
        "account_currency": "EUR",
        "approval_fx_rate": 1.1,
        "notes": "audit me",
        "decision_context": {"setup_status": "PASS"},
    }


def _position(position_id="POS-AAPL-001", source_order_id=None):
    return {
        "position_id": position_id,
        "source_order_id": source_order_id,
        "ticker": "AAPL",
        "status": "open",
        "shares": 2,
        "entry_date": "2026-07-15",
        "entry_price": 100.125,
        "stop_price": 95.25,
        "target_price": 110.5,
        "quote_currency": "USD",
        "account_currency": "EUR",
        "entry_fx_rate": 1.1,
        "thesis": "breakout",
        "tags": ["swing"],
    }


def test_repository_round_trip_preserves_shape_and_float_boundary(runtime):
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        uow.begin_write()
        uow.orders.add_order(_order())
        uow.positions.add_position(_position(source_order_id="ORD-AAPL-001"))

    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        orders, asof = uow.orders.list_orders()
        positions, _ = uow.positions.list_positions(status="open")

    assert asof == "2026-07-15"
    assert orders[0]["limit_price"] == 100.125
    assert isinstance(orders[0]["limit_price"], float)
    assert orders[0]["notes"] == "audit me"
    assert orders[0]["decision_context"] == {"setup_status": "PASS"}
    assert positions[0]["entry_price"] == 100.125
    assert positions[0]["thesis"] == "breakout"
    assert positions[0]["version"] == 1


def test_conditional_transitions_and_versions_detect_conflicts(runtime):
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        uow.begin_write()
        uow.orders.add_order(_order())
        uow.positions.add_position(_position())

    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        uow.begin_write()
        order = uow.orders.transition(
            "ORD-AAPL-001", {"pending"}, {"status": "submitted"}
        )
        position = uow.positions.replace_position(
            "POS-AAPL-001", 1, {**_position(), "stop_price": 97}
        )
        assert order["status"] == "submitted"
        assert position["version"] == 2
        assert (
            uow.orders.transition("ORD-AAPL-001", {"pending"}, {"status": "cancelled"})
            is None
        )
        assert (
            uow.positions.replace_position(
                "POS-AAPL-001", 1, {**_position(), "stop_price": 98}
            )
            is None
        )


def test_duplicate_source_order_is_rejected(runtime):
    from sqlalchemy.exc import IntegrityError

    with pytest.raises(IntegrityError):
        with PortfolioUnitOfWork(runtime.session_factory) as uow:
            uow.begin_write()
            uow.positions.add_position(_position("POS-1", "ORD-1"))
            uow.positions.add_position(_position("POS-2", "ORD-1"))
