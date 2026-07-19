from __future__ import annotations

import pytest

from api.models.portfolio import CreateOrderRequest
from api.services.orders_service import OrdersService
from swing_screener.errors import UnprocessableError


class _Orders:
    def __init__(self, orders=None):
        self.orders = list(orders or [])

    def list_orders(self, status=None):
        return self.orders, "2026-07-13"

    def append_order(self, order):
        self.orders.append(order)


class _Positions:
    def __init__(self, positions=None):
        self.positions = list(positions or [])

    def list_positions(self, status=None):
        values = self.positions
        if status:
            values = [item for item in values if item.get("status") == status]
        return values, "2026-07-13"


class _Strategies:
    def get_active_strategy(self):
        return {
            "risk": {
                "account_size": 10_000,
                "min_rr": 2.0,
                "max_portfolio_heat_pct": 0.06,
                "max_concentration_pct": 60.0,
            }
        }


def _request(**updates) -> CreateOrderRequest:
    payload = {
        "ticker": "AAPL",
        "order_type": "BUY_LIMIT",
        "quantity": 10,
        "limit_price": 100.0,
        "stop_price": 95.0,
        "target_price": 110.0,
        "setup_status": "PASS",
        "trigger_status": "PASS",
        "data_status": "current",
        "data_asof": "2026-07-13",
        "target_source": "structural",
        "days_to_earnings": 20,
    }
    payload.update(updates)
    return CreateOrderRequest(**payload)


def _service(*, orders=None, positions=None) -> OrdersService:
    return OrdersService(
        _Orders(orders),
        _Positions(positions),
        strategy_repo=_Strategies(),
    )


def test_order_persists_portfolio_approval_only_after_all_gates_pass():
    order = _service().create_order(_request())

    assert order["portfolio_approval"]["approved"] is True
    assert order["portfolio_approval"]["cash"]["status"] == "PASS"
    assert order["decision_context"]["target_source"] == "structural"


@pytest.mark.parametrize(
    ("updates", "message"),
    [
        ({"trigger_status": "WAIT"}, "trigger"),
        ({"data_status": "stale"}, "stale"),
        ({"target_source": "unknown"}, "independently validated"),
        ({"days_to_earnings": None}, "event"),
    ],
)
def test_order_cannot_bypass_decision_or_event_permission(updates, message):
    with pytest.raises(UnprocessableError, match=message):
        _service().create_order(_request(**updates))


def test_order_blocks_projected_heat_including_pending_entries():
    pending = [{
        "ticker": "MSFT", "status": "pending", "order_kind": "entry",
        "limit_price": 100.0, "stop_price": 94.2, "quantity": 95,
    }]

    with pytest.raises(UnprocessableError, match="heat"):
        _service(orders=pending).create_order(_request())


def test_order_blocks_projected_country_concentration():
    positions = [{
        "ticker": "MSFT", "status": "open", "entry_price": 100.0,
        "stop_price": 99.0, "shares": 55,
    }]

    with pytest.raises(UnprocessableError, match="concentration"):
        _service(positions=positions).create_order(_request())
