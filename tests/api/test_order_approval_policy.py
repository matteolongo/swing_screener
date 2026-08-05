from __future__ import annotations

from decimal import Decimal

import pytest

from api.services.order_approval import (
    EffectiveOrderPolicy,
    SubmittedPlan,
    evaluate_order_approval,
)
from api.services.order_approval_token import VerifiedApprovalToken
from api.services.order_exposure import ProposedExposure, build_exposure_snapshot


def _context(**updates) -> VerifiedApprovalToken:
    payload = {
        "ticker": "AAPL",
        "order_type": "BUY_LIMIT",
        "setup_status": "PASS",
        "trigger_status": "PASS",
        "plan_status": "PASS",
        "data_status": "current",
        "data_asof": "2026-07-15",
        "strategy_id": "momentum-v1",
        "strategy_revision": "revision-1",
        "account_currency": "EUR",
        "quote_currency": "EUR",
        "account_to_quote_rate": 1,
        "target_source": "structural",
        "days_to_earnings": 20,
        "generated_entry": 100,
        "generated_stop": 95,
        "generated_target": 112,
        "version": 1,
        "token_id": "a" * 32,
        "issued_at": 1000,
        "expires_at": 2000,
        "plan_fingerprint": "f" * 64,
    }
    payload.update(updates)
    return VerifiedApprovalToken(**payload)


def _policy(**updates) -> EffectiveOrderPolicy:
    values = {
        "account_size": Decimal("10000"),
        "risk_pct": Decimal("0.01"),
        "max_position_pct": Decimal("0.20"),
        "max_portfolio_heat_pct": Decimal("0.06"),
        "min_rr": Decimal("2"),
        "commission_pct": Decimal("0.001"),
        "max_fee_risk_pct": Decimal("0.20"),
        "max_concentration_pct": Decimal("60"),
        "account_currency": "EUR",
    }
    values.update(updates)
    return EffectiveOrderPolicy(**values)


def _evaluate(
    *,
    quantity=10,
    entry="100",
    stop="95",
    target="112",
    positions=(),
    orders=(),
    policy=None,
    context=None,
):
    submitted = SubmittedPlan(
        ticker="AAPL",
        quantity=quantity,
        entry=Decimal(entry),
        stop=Decimal(stop),
        target=Decimal(target),
    )
    proposed = ProposedExposure(
        ticker="AAPL",
        quantity=quantity,
        entry=Decimal(entry),
        stop=Decimal(stop),
        account_currency="EUR",
        quote_currency="EUR",
        account_to_quote_rate=Decimal("1"),
    )
    snapshot = build_exposure_snapshot(list(positions), list(orders), proposed)
    return evaluate_order_approval(
        context or _context(), submitted, snapshot, policy or _policy()
    )


def test_valid_first_position_is_approved_with_concentration_warning():
    approval = _evaluate()

    assert approval.approved is True
    assert approval.trade_risk.status == "PASS"
    assert approval.concentration.status == "WARN"
    assert approval.concentration.projected == 100
    assert approval.estimated_fees == 2
    assert approval.projected_risk == 52


def test_waiting_pullback_buy_limit_is_approved():
    approval = _evaluate(context=_context(trigger_status="WAIT"))

    assert approval.approved is True
    assert approval.decision.status == "PASS"


def test_waiting_breakout_buy_stop_is_blocked():
    approval = _evaluate(
        context=_context(order_type="BUY_STOP", trigger_status="WAIT")
    )

    assert approval.approved is False
    assert approval.decision.status == "BLOCK"


@pytest.mark.parametrize(
    ("kwargs", "gate"),
    [
        ({"stop": "100"}, "coherence"),
        ({"target": "108"}, "reward_risk"),
        ({"quantity": 30}, "trade_risk"),
        ({"quantity": 21}, "position"),
        ({"quantity": 101}, "cash"),
        ({"policy": _policy(commission_pct=Decimal("0.02"))}, "fees"),
        ({"context": _context(days_to_earnings=3)}, "event"),
    ],
)
def test_each_hard_gate_blocks_independently(kwargs, gate):
    approval = _evaluate(**kwargs)

    assert approval.approved is False
    assert getattr(approval, gate).status == "BLOCK"


def test_heat_includes_existing_open_risk():
    positions = (
        {
            "ticker": "SAP.DE",
            "status": "open",
            "entry_price": 100,
            "stop_price": 94.5,
            "shares": 100,
            "quote_currency": "EUR",
            "entry_fx_rate": 1,
        },
    )

    approval = _evaluate(positions=positions)

    assert approval.heat.status == "BLOCK"


def test_country_concentration_uses_risk_share_not_notional():
    positions = (
        {
            "ticker": "SAP.DE",
            "status": "open",
            "entry_price": 100,
            "stop_price": 99,
            "shares": 100,
            "quote_currency": "EUR",
            "entry_fx_rate": 1,
        },
    )

    approval = _evaluate(positions=positions)

    assert approval.concentration.projected == pytest.approx(33.33, abs=0.01)
    assert approval.concentration.status == "PASS"
