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
    def __init__(self):
        self.orders = []

    def list_orders(self, status=None):
        return self.orders, "2026-07-15"

    def append_order(self, order):
        self.orders.append(order)


class _Positions:
    def list_positions(self, status=None):
        return [], "2026-07-15"


class _Strategies:
    strategy_id = "momentum-v1"

    def get_active_strategy_id(self):
        return self.strategy_id

    def get_active_strategy(self):
        return {
            "id": self.strategy_id,
            "updated_at": "2026-07-15T10:00:00",
            "risk": {
                "account_size": 10_000,
                "risk_pct": 0.01,
                "max_position_pct": 0.6,
                "max_portfolio_heat_pct": 0.06,
                "min_rr": 2,
                "commission_pct": 0,
                "max_fee_risk_pct": 0.2,
                "max_concentration_pct": 60,
                "account_currency": "EUR",
            },
        }


SIGNER = OrderApprovalTokenSigner(b"k" * 32, ttl_seconds=100)


def _token(**updates) -> str:
    active_strategy = _Strategies().get_active_strategy()
    values = {
        "ticker": "AAPL",
        "order_type": "BUY_LIMIT",
        "setup_status": "PASS",
        "trigger_status": "PASS",
        "plan_status": "PASS",
        "data_status": "current",
        "data_asof": "2026-07-15",
        "strategy_id": "momentum-v1",
        "strategy_revision": strategy_revision(active_strategy),
        "account_currency": "EUR",
        "quote_currency": "EUR",
        "account_to_quote_rate": 1,
        "target_source": "structural",
        "days_to_earnings": 20,
        "generated_entry": 100,
        "generated_stop": 95,
        "generated_target": 112,
    }
    values.update(updates)
    return SIGNER.issue(ApprovalTokenClaims(**values), now=1_000)


def _request(**updates) -> CreateOrderRequest:
    values = {
        "ticker": "AAPL",
        "order_type": "BUY_LIMIT",
        "quantity": 10,
        "limit_price": 100,
        "stop_price": 95,
        "target_price": 112,
        "approval_token": _token(),
    }
    values.update(updates)
    return CreateOrderRequest(**values)


def _service(strategies=None) -> OrdersService:
    return OrdersService(
        _Orders(),
        _Positions(),
        strategy_repo=strategies or _Strategies(),
        approval_signer=SIGNER,
        approval_now=lambda: 1_050,
    )


def test_signed_context_drives_and_audits_entry_approval():
    order = _service().create_order(
        _request(trigger_status="BLOCK", data_status="stale")
    )

    assert order["portfolio_approval"]["approved"] is True
    assert order["decision_context"]["trigger_status"] == "PASS"
    assert order["portfolio_approval"]["token_id"]
    assert order["quote_currency"] == "EUR"


def test_signed_waiting_pullback_buy_limit_is_approved():
    order = _service().create_order(
        _request(approval_token=_token(trigger_status="WAIT"))
    )

    assert order["portfolio_approval"]["approved"] is True
    assert order["decision_context"]["trigger_status"] == "WAIT"


@pytest.mark.parametrize("token", [None, "tampered.token"])
def test_missing_or_tampered_token_blocks_entry(token):
    with pytest.raises(UnprocessableError, match="approval token"):
        _service().create_order(_request(approval_token=token))


def test_ticker_mismatch_and_active_strategy_change_block_entry():
    with pytest.raises(UnprocessableError, match="ticker"):
        _service().create_order(_request(approval_token=_token(ticker="MSFT")))

    strategies = _Strategies()
    strategies.strategy_id = "momentum-v2"
    with pytest.raises(UnprocessableError, match="strategy"):
        _service(strategies).create_order(_request())


def test_submitted_quantity_and_prices_are_recomputed_not_overwritten():
    with pytest.raises(UnprocessableError, match="trade_risk"):
        _service().create_order(_request(quantity=30))


def test_entry_order_fails_closed_when_signer_is_not_configured():
    service = OrdersService(_Orders(), _Positions(), strategy_repo=_Strategies())

    with pytest.raises(UnprocessableError, match="signer"):
        service.create_order(_request())


def test_strategy_update_with_same_id_invalidates_token():
    strategies = _Strategies()
    original_get = strategies.get_active_strategy

    def changed_strategy():
        value = original_get()
        value["updated_at"] = "2026-07-15T11:00:00"
        value["risk"]["risk_pct"] = 0.005
        return value

    strategies.get_active_strategy = changed_strategy

    with pytest.raises(UnprocessableError, match="strategy"):
        _service(strategies).create_order(_request())
