from __future__ import annotations

import json

import pytest

from api.models.portfolio import (
    ClosePositionRequest,
    FillOrderRequest,
    PartialCloseRequest,
)
from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.services.portfolio_service import PortfolioService
from api.services.orders_service import OrdersService
from swing_screener.errors import ConflictError


def test_full_exit_cancels_linked_stop_but_preserves_filled_entry():
    from api.services.portfolio.linked_exits import reconcile_linked_exit_records

    records = reconcile_linked_exit_records(
        {"position_id": "P1", "status": "closed", "shares": 5},
        [
            {
                "order_id": "E1",
                "position_id": "P1",
                "order_kind": "entry",
                "status": "filled",
                "quantity": 10,
            },
            {
                "order_id": "S1",
                "position_id": "P1",
                "order_kind": "stop",
                "status": "pending",
                "quantity": 10,
            },
        ],
    )

    by_id = {row["order_id"]: row for row in records}
    assert by_id["S1"]["status"] == "cancelled"
    assert by_id["E1"]["status"] == "filled"


@pytest.mark.parametrize("filled_exit_order_id", [None, "S1"])
def test_reconciliation_rejects_ambiguous_active_protection(filled_exit_order_id):
    from api.services.portfolio.linked_exits import reconcile_linked_exit_records

    with pytest.raises(ConflictError, match="Multiple active linked protective orders"):
        reconcile_linked_exit_records(
            {"position_id": "P1", "status": "open", "shares": 5},
            [
                {
                    "order_id": "S1",
                    "position_id": "P1",
                    "order_kind": "stop",
                    "status": "pending",
                    "quantity": 10,
                },
                {
                    "order_id": "S2",
                    "position_id": "P1",
                    "order_kind": "stop",
                    "status": "submitted",
                    "quantity": 10,
                },
            ],
            filled_exit_order_id=filled_exit_order_id,
        )


def test_position_exit_reconciles_linked_protection_in_the_local_ledger(tmp_path):
    positions_path = tmp_path / "positions.json"
    orders_path = tmp_path / "orders.json"
    positions_path.write_text(
        json.dumps(
            {
                "positions": [
                    {
                        "position_id": "P1",
                        "ticker": "AAPL",
                        "status": "open",
                        "entry_date": "2026-10-01",
                        "entry_price": 100,
                        "stop_price": 95,
                        "shares": 10,
                        "initial_risk": 5,
                    }
                ]
            }
        )
    )
    orders_path.write_text(
        json.dumps(
            {
                "orders": [
                    {
                        "order_id": "E1",
                        "position_id": "P1",
                        "order_kind": "entry",
                        "status": "filled",
                        "quantity": 10,
                    },
                    {
                        "order_id": "S1",
                        "position_id": "P1",
                        "order_kind": "stop",
                        "status": "pending",
                        "quantity": 10,
                    },
                    {
                        "order_id": "T1",
                        "position_id": "P1",
                        "order_kind": "take_profit",
                        "status": "pending",
                        "quantity": 10,
                    },
                ]
            }
        )
    )
    service = PortfolioService(
        positions_repo=PositionsRepository(positions_path),
        orders_repo=OrdersRepository(orders_path),
    )

    service.partial_close_position(
        "P1", PartialCloseRequest(shares_closed=5, price=110)
    )

    after_partial = json.loads(orders_path.read_text())["orders"]
    assert {order["order_id"]: order["quantity"] for order in after_partial} == {
        "E1": 10,
        "S1": 5,
        "T1": 5,
    }
    service.close_position("P1", ClosePositionRequest(exit_price=108))

    after_final = {
        order["order_id"]: order
        for order in json.loads(orders_path.read_text())["orders"]
    }
    assert after_final["E1"]["status"] == "filled"
    assert after_final["S1"]["status"] == "cancelled"
    assert after_final["T1"]["status"] == "cancelled"


def test_filled_exit_stays_filled_while_other_protection_is_cancelled(tmp_path):
    positions_path = tmp_path / "positions.json"
    orders_path = tmp_path / "orders.json"
    positions_path.write_text(
        json.dumps(
            {
                "positions": [
                    {
                        "position_id": "P1",
                        "ticker": "AAPL",
                        "status": "open",
                        "entry_date": "2026-10-01",
                        "entry_price": 100,
                        "stop_price": 95,
                        "shares": 5,
                        "initial_risk": 5,
                    }
                ]
            }
        )
    )
    orders_path.write_text(
        json.dumps(
            {
                "orders": [
                    {
                        "order_id": "S1",
                        "position_id": "P1",
                        "ticker": "AAPL",
                        "order_kind": "stop",
                        "order_type": "SELL_STOP",
                        "status": "pending",
                        "quantity": 5,
                        "stop_price": 95,
                    },
                    {
                        "order_id": "T1",
                        "position_id": "P1",
                        "ticker": "AAPL",
                        "order_kind": "take_profit",
                        "order_type": "SELL_LIMIT",
                        "status": "pending",
                        "quantity": 5,
                        "limit_price": 110,
                    },
                ]
            }
        )
    )
    service = OrdersService(
        orders_repo=OrdersRepository(orders_path),
        positions_repo=PositionsRepository(positions_path),
    )

    service.fill_order(
        "T1", FillOrderRequest(filled_price=110, filled_date="2026-10-14")
    )

    orders = {
        order["order_id"]: order
        for order in json.loads(orders_path.read_text())["orders"]
    }
    assert orders["T1"]["status"] == "filled"
    assert orders["S1"]["status"] == "cancelled"
