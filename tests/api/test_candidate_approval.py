from __future__ import annotations

from types import SimpleNamespace

import pytest

from api.services.screener_service import _approval_claims_for_candidate


def _candidate(**updates):
    gates = SimpleNamespace(
        setup=SimpleNamespace(status="PASS"),
        trigger=SimpleNamespace(status="PASS"),
        plan=SimpleNamespace(status="PASS"),
    )
    risk = SimpleNamespace(
        entry=100.0,
        stop=95.0,
        target=112.0,
        target_source="structural",
        account_currency="EUR",
        currency="USD",
        account_to_quote_rate=1.1,
    )
    values = {
        "ticker": "AAPL",
        "suggested_order_type": "BUY_LIMIT",
        "data_status": "current",
        "data_asof": "2026-07-15",
        "days_to_earnings": 20,
        "recommendation": SimpleNamespace(
            verdict="RECOMMENDED", decision_gates=gates, risk=risk
        ),
    }
    values.update(updates)
    return SimpleNamespace(**values)


def test_actionable_candidate_produces_complete_signed_claims():
    claims = _approval_claims_for_candidate(_candidate(), "momentum-v1", "revision-1")

    assert claims is not None
    assert claims.ticker == "AAPL"
    assert claims.strategy_id == "momentum-v1"
    assert claims.strategy_revision == "revision-1"
    assert claims.account_to_quote_rate == 1.1
    assert claims.target_source == "structural"


@pytest.mark.parametrize(
    "candidate",
    [
        _candidate(data_status="stale"),
        _candidate(data_asof=None),
        _candidate(days_to_earnings=3),
        _candidate(recommendation=None),
    ],
)
def test_incomplete_candidate_receives_no_claims(candidate):
    assert (
        _approval_claims_for_candidate(candidate, "momentum-v1", "revision-1") is None
    )


def test_nonpassing_decision_gate_receives_no_claims():
    candidate = _candidate()
    candidate.recommendation.decision_gates.trigger.status = "WAIT"

    assert (
        _approval_claims_for_candidate(candidate, "momentum-v1", "revision-1") is None
    )


def test_same_currency_candidate_uses_identity_without_provider_fx():
    candidate = _candidate()
    candidate.recommendation.risk.currency = "EUR"
    candidate.recommendation.risk.account_to_quote_rate = None

    claims = _approval_claims_for_candidate(candidate, "momentum-v1", "revision-1")

    assert claims is not None
    assert claims.account_to_quote_rate == 1
