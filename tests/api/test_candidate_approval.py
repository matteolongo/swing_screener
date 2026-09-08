from __future__ import annotations

from types import SimpleNamespace

import pytest

from api.models.screener import SameSymbolCandidateContext
from api.services.order_approval import resolve_execution_eligibility
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


def test_waiting_pullback_buy_limit_produces_wait_claims():
    candidate = _candidate()
    candidate.recommendation.verdict = "NOT_RECOMMENDED"
    candidate.recommendation.workflow_status = "waiting_trigger"
    candidate.recommendation.next_step = SimpleNamespace(code="wait_pullback")
    candidate.recommendation.decision_gates.trigger.status = "WAIT"

    claims = _approval_claims_for_candidate(candidate, "momentum-v1", "revision-1")

    assert claims is not None
    assert claims.trigger_status == "WAIT"


def test_waiting_breakout_buy_stop_receives_no_claims():
    candidate = _candidate(suggested_order_type="BUY_STOP")
    candidate.recommendation.workflow_status = "waiting_trigger"
    candidate.recommendation.next_step = SimpleNamespace(code="wait_breakout_close")
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


def _eligibility_candidate(
    *,
    suggested_order_type="BUY_LIMIT",
    workflow_status="ready",
    next_step_code="review_order",
    approval_token="signed-approval",
    data_status="current",
    data_asof="2026-09-08",
    entry=100.0,
    stop=95.0,
    target=112.0,
    shares=20,
    rr=2.4,
    quote_currency="USD",
    same_symbol=None,
):
    return SimpleNamespace(
        suggested_order_type=suggested_order_type,
        approval_token=approval_token,
        data_status=data_status,
        data_asof=data_asof,
        entry=entry,
        stop=stop,
        target=target,
        shares=shares,
        rr=rr,
        quote_currency=quote_currency,
        same_symbol=same_symbol,
        recommendation=SimpleNamespace(
            workflow_status=workflow_status,
            next_step=SimpleNamespace(code=next_step_code),
        ),
    )


@pytest.mark.parametrize(
    (
        "candidate",
        "require_approval",
        "expected_allowed",
        "expected_mode",
        "expected_reason",
    ),
    [
        pytest.param(
            _eligibility_candidate(),
            True,
            True,
            "ready",
            None,
            id="ready",
        ),
        pytest.param(
            _eligibility_candidate(
                workflow_status="waiting_trigger",
                next_step_code="wait_pullback",
            ),
            True,
            True,
            "pending_pullback",
            None,
            id="pending-pullback-buy-limit",
        ),
        pytest.param(
            _eligibility_candidate(suggested_order_type="SKIP"),
            True,
            False,
            None,
            "skip_guidance",
            id="skip",
        ),
        pytest.param(
            _eligibility_candidate(
                workflow_status="needs_review", next_step_code="refresh_data"
            ),
            True,
            False,
            None,
            "workflow_not_actionable",
            id="workflow-not-actionable",
        ),
        pytest.param(
            _eligibility_candidate(data_status="stale"),
            True,
            False,
            None,
            "data_not_current",
            id="stale-data",
        ),
        pytest.param(
            _eligibility_candidate(data_asof=None),
            True,
            False,
            None,
            "data_not_current",
            id="missing-data-provenance",
        ),
        pytest.param(
            _eligibility_candidate(approval_token=None),
            True,
            False,
            None,
            "approval_missing",
            id="missing-required-approval",
        ),
        pytest.param(
            _eligibility_candidate(target=None),
            True,
            False,
            None,
            "plan_incomplete",
            id="incomplete-plan",
        ),
        pytest.param(
            _eligibility_candidate(stop=105.0),
            True,
            False,
            None,
            "plan_invalid",
            id="inverted-plan",
        ),
        pytest.param(
            _eligibility_candidate(entry=0.0),
            True,
            False,
            None,
            "plan_invalid",
            id="zero-plan-value",
        ),
        pytest.param(
            _eligibility_candidate(rr=float("nan")),
            True,
            False,
            None,
            "plan_invalid",
            id="non-finite-plan-value",
        ),
        pytest.param(
            _eligibility_candidate(quote_currency="JPY"),
            True,
            False,
            None,
            "plan_invalid",
            id="unsupported-currency",
        ),
        pytest.param(
            _eligibility_candidate(
                same_symbol=SameSymbolCandidateContext(
                    mode="NEW_ENTRY", position_id="POS-1"
                )
            ),
            True,
            False,
            None,
            "held_symbol_not_add_on",
            id="held-new-entry",
        ),
        pytest.param(
            _eligibility_candidate(
                same_symbol=SameSymbolCandidateContext(
                    mode="ADD_ON", position_id="POS-1"
                )
            ),
            True,
            True,
            "ready",
            None,
            id="held-add-on",
        ),
        pytest.param(
            _eligibility_candidate(
                same_symbol=SameSymbolCandidateContext(
                    mode="SCALE_BACK", position_id="POS-1"
                )
            ),
            True,
            True,
            "ready",
            None,
            id="held-scale-back",
        ),
    ],
)
def test_execution_eligibility_resolver_is_fail_closed(
    candidate,
    require_approval,
    expected_allowed,
    expected_mode,
    expected_reason,
):
    eligibility, draft = resolve_execution_eligibility(
        candidate, require_approval=require_approval
    )

    assert eligibility.allowed is expected_allowed
    assert eligibility.mode == expected_mode
    assert eligibility.reason == expected_reason
    assert (draft is not None) is expected_allowed


def test_execution_eligibility_builds_the_canonical_order_draft():
    eligibility, draft = resolve_execution_eligibility(
        _eligibility_candidate(), require_approval=True
    )

    assert eligibility.model_dump() == {
        "allowed": True,
        "mode": "ready",
        "reason": None,
    }
    assert draft is not None
    assert draft.model_dump() == {
        "order_type": "BUY_LIMIT",
        "entry": 100.0,
        "stop": 95.0,
        "target": 112.0,
        "shares": 20,
        "rr": 2.4,
        "quote_currency": "USD",
        "approval_token": "signed-approval",
    }


def test_pre_token_eligibility_does_not_require_approval_identity():
    eligibility, draft = resolve_execution_eligibility(
        _eligibility_candidate(approval_token=None), require_approval=False
    )

    assert eligibility.allowed is True
    assert eligibility.mode == "ready"
    assert eligibility.reason is None
    assert draft is not None
    assert draft.approval_token is None
