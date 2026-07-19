from __future__ import annotations

import pytest

from api.models.portfolio import CreateOrderRequest
from api.services.order_approval_token import (
    ApprovalTokenClaims,
    OrderApprovalTokenSigner,
    strategy_revision,
)
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
            "id": "momentum-v1",
            "updated_at": "2026-07-13T10:00:00",
            "risk": {
                "account_size": 10_000,
                "risk_pct": 0.01,
                "max_position_pct": 0.60,
                "min_rr": 2.0,
                "commission_pct": 0,
                "max_fee_risk_pct": 0.20,
                "max_portfolio_heat_pct": 0.06,
                "max_concentration_pct": 60.0,
                "account_currency": "EUR",
            },
        }


SIGNER = OrderApprovalTokenSigner(b"p" * 32, ttl_seconds=100)


def _token(**updates) -> str:
    strategy = _Strategies().get_active_strategy()
    payload = {
        "ticker": "AAPL",
        "order_type": "BUY_LIMIT",
        "setup_status": "PASS",
        "trigger_status": "PASS",
        "plan_status": "PASS",
        "data_status": "current",
        "data_asof": "2026-07-13",
        "strategy_id": "momentum-v1",
        "strategy_revision": strategy_revision(strategy),
        "account_currency": "EUR",
        "quote_currency": "EUR",
        "account_to_quote_rate": 1,
        "target_source": "structural",
        "days_to_earnings": 20,
        "generated_entry": 100,
        "generated_stop": 95,
        "generated_target": 110,
    }
    payload.update(updates)
    return SIGNER.issue(ApprovalTokenClaims(**payload), now=1_000)


def _request(*, token_updates=None, **updates) -> CreateOrderRequest:
    payload = {
        "ticker": "AAPL",
        "order_type": "BUY_LIMIT",
        "quantity": 10,
        "limit_price": 100.0,
        "stop_price": 95.0,
        "target_price": 110.0,
        "approval_token": _token(**(token_updates or {})),
    }
    payload.update(updates)
    return CreateOrderRequest(**payload)


def _service(*, orders=None, positions=None) -> OrdersService:
    return OrdersService(
        _Orders(orders),
        _Positions(positions),
        strategy_repo=_Strategies(),
        approval_signer=SIGNER,
        approval_now=lambda: 1_050,
    )


def test_order_persists_portfolio_approval_only_after_all_gates_pass():
    order = _service().create_order(_request())

    assert order["portfolio_approval"]["approved"] is True
    assert order["portfolio_approval"]["cash"]["status"] == "PASS"
    assert order["decision_context"]["target_source"] == "structural"


@pytest.mark.parametrize(
    ("token_updates", "message"),
    [
        ({"trigger_status": "WAIT"}, "decision"),
        ({"data_status": "stale"}, "decision"),
        ({"target_source": "unknown"}, "decision"),
        ({"days_to_earnings": 3}, "event"),
    ],
)
def test_signed_decision_or_event_permission_cannot_be_bypassed(token_updates, message):
    with pytest.raises(UnprocessableError, match=message):
        _service().create_order(_request(token_updates=token_updates))


def test_order_blocks_projected_heat_including_pending_entries():
    pending = [
        {
            "ticker": "MSFT",
            "status": "pending",
            "order_kind": "entry",
            "limit_price": 100.0,
            "stop_price": 94.2,
            "quantity": 95,
            "quote_currency": "EUR",
            "account_currency": "EUR",
            "approval_fx_rate": 1,
        }
    ]

    with pytest.raises(UnprocessableError, match="heat"):
        _service(orders=pending).create_order(_request())


def test_projected_country_concentration_warns_without_blocking():
    positions = [
        {
            "ticker": "MSFT",
            "status": "open",
            "entry_price": 100.0,
            "stop_price": 99.0,
            "shares": 55,
            "quote_currency": "EUR",
            "account_currency": "EUR",
            "entry_fx_rate": 1,
        }
    ]

    order = _service(positions=positions).create_order(_request())

    assert order["portfolio_approval"]["approved"] is True
    assert order["portfolio_approval"]["concentration"]["status"] == "WARN"
