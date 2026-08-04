from __future__ import annotations

from types import SimpleNamespace

import pytest

from api.models.recommendation import (
    ChecklistGate,
    DecisionGateModel,
    DecisionGateStateModel,
    ExecutionNextStepModel,
    Recommendation,
    RecommendationCosts,
    RecommendationEducation,
    RecommendationReason,
    RecommendationRisk,
)
from api.models.screener import ScreenerCandidate
from api.services.same_symbol_reentry import (
    SameSymbolReentryEvaluator,
    _copy_recommendation_with_adjusted_risk,
)
from tests.api._test_helpers import make_order, make_position


def _make_recommendation(
    *,
    verdict: str = "RECOMMENDED",
    entry: float = 23.0,
    stop: float = 21.62,
    shares: int = 5,
) -> Recommendation:
    risk_amount = (entry - stop) * shares
    return Recommendation(
        verdict=verdict,
        reasons_short=["Valid setup"],
        reasons_detailed=[
            RecommendationReason(
                code="VALID",
                message="Setup is valid.",
                severity="info",
            )
        ],
        risk=RecommendationRisk(
            entry=entry,
            stop=stop,
            target=entry + ((entry - stop) * 2),
            desired_target=entry + ((entry - stop) * 2),
            target_source="structural",
            rr=2.0,
            risk_amount=risk_amount,
            risk_pct=0.0138,
            position_size=entry * shares,
            shares=shares,
            invalidation_level=stop,
        ),
        costs=RecommendationCosts(
            commission_estimate=0.0,
            fx_estimate=0.0,
            slippage_estimate=0.0,
            total_cost=0.0,
            fee_to_risk_pct=0.0,
        ),
        checklist=[
            ChecklistGate(gate_name="signal", passed=True, explanation="Signal active.")
        ],
        decision_gates=DecisionGateStateModel(
            setup=DecisionGateModel(status="PASS", explanation="Setup qualified."),
            trigger=DecisionGateModel(status="PASS", explanation="Trigger observed."),
            plan=DecisionGateModel(status="PASS", explanation="Plan reconciled."),
            portfolio=DecisionGateModel(
                status="UNKNOWN", explanation="Checked on submit."
            ),
            ready_to_order=False,
        ),
        workflow_status="ready",
        next_step=ExecutionNextStepModel(code="review_order"),
        education=RecommendationEducation(
            common_bias_warning="None",
            what_to_learn="None",
            what_would_make_valid=[],
        ),
    )


def _make_candidate() -> ScreenerCandidate:
    recommendation = _make_recommendation()
    return ScreenerCandidate(
        ticker="REP.MC",
        currency="EUR",
        close=23.0,
        sma_20=22.0,
        sma_50=21.0,
        sma_200=18.0,
        atr=0.8,
        momentum_6m=0.15,
        momentum_12m=0.25,
        rel_strength=1.2,
        score=99.4,
        confidence=92.7,
        rank=1,
        signal="BREAKOUT",
        entry=recommendation.risk.entry,
        stop=recommendation.risk.stop,
        target=recommendation.risk.target,
        rr=recommendation.risk.rr,
        shares=recommendation.risk.shares,
        position_size_usd=recommendation.risk.position_size,
        risk_usd=recommendation.risk.risk_amount,
        risk_pct=recommendation.risk.risk_pct,
        recommendation=recommendation,
        suggested_order_type="BUY_LIMIT",
        suggested_order_price=22.83,
        execution_note="Pullback entry inside uptrend.",
    )


class _FakePortfolioService:
    def __init__(self, action: str = "NO_ACTION") -> None:
        self.action = action

    def suggest_position_stop(self, position_id: str):
        return SimpleNamespace(action=self.action, position_id=position_id)


def test_same_symbol_reentry_marks_fresh_symbols_as_new_entry():
    evaluator = SameSymbolReentryEvaluator(_FakePortfolioService())
    candidate = _make_candidate()

    enriched, context = evaluator.evaluate(
        candidate,
        positions=[],
        orders=[],
        account_size=500.0,
        risk_pct_target=0.02,
        max_position_pct=0.4,
        min_shares=1,
        min_rr=2.0,
    )

    assert enriched is not None
    assert context.mode == "NEW_ENTRY"
    assert enriched.same_symbol is not None
    assert enriched.same_symbol.mode == "NEW_ENTRY"


def test_same_symbol_reentry_uses_live_stop_for_add_on():
    evaluator = SameSymbolReentryEvaluator(_FakePortfolioService(action="NO_ACTION"))
    candidate = _make_candidate()
    position = make_position(
        ticker="REP.MC",
        position_id="POS-REP-1",
        entry_price=19.63,
        current_price=23.0,
        stop_price=21.8,
        shares=5,
    )

    enriched, context = evaluator.evaluate(
        candidate,
        positions=[position],
        orders=[],
        account_size=1000.0,
        risk_pct_target=0.03,
        max_position_pct=0.6,
        min_shares=1,
        min_rr=2.0,
    )

    assert enriched is not None
    assert context.mode == "ADD_ON"
    assert enriched.same_symbol is not None
    assert enriched.same_symbol.current_position_stop == 21.8
    assert enriched.same_symbol.fresh_setup_stop == 21.62
    assert enriched.stop == 21.8
    assert enriched.recommendation is not None
    assert enriched.recommendation.risk.stop == 21.8
    assert enriched.recommendation.risk.target_source == "structural"
    assert enriched.recommendation.risk.desired_target == pytest.approx(25.76)
    assert enriched.shares == 5
    assert "Live stop 21.80 is used for execution" in (enriched.execution_note or "")


def test_same_symbol_reentry_rejects_add_on_when_live_stop_breaks_minimum_rr():
    evaluator = SameSymbolReentryEvaluator(_FakePortfolioService(action="NO_ACTION"))
    candidate = _make_candidate()
    position = make_position(
        ticker="REP.MC",
        position_id="POS-REP-1",
        entry_price=19.63,
        current_price=23.0,
        stop_price=19.63,
        shares=5,
    )

    enriched, context = evaluator.evaluate(
        candidate,
        positions=[position],
        orders=[],
        account_size=1000.0,
        risk_pct_target=0.03,
        max_position_pct=0.6,
        min_shares=1,
        min_rr=2.0,
    )

    assert enriched is candidate
    assert context.mode == "MANAGE_ONLY"
    assert candidate.recommendation is not None
    assert candidate.recommendation.risk.stop == 19.63
    assert candidate.recommendation.risk.rr == 0.819
    assert candidate.recommendation.workflow_status == "needs_review"
    assert candidate.recommendation.next_step.code == "define_target"
    assert (
        context.reason == "The live-stop reward:risk is below the configured minimum."
    )


def test_same_symbol_reentry_rejects_add_on_when_live_stop_breaks_fee_limit():
    evaluator = SameSymbolReentryEvaluator(_FakePortfolioService(action="NO_ACTION"))
    candidate = _make_candidate()
    assert candidate.recommendation is not None
    candidate.recommendation.costs = RecommendationCosts(
        commission_estimate=0.8,
        fx_estimate=0.0,
        slippage_estimate=0.5,
        total_cost=1.3,
        fee_to_risk_pct=0.1884,
    )
    position = make_position(
        ticker="REP.MC",
        position_id="POS-REP-1",
        entry_price=19.63,
        current_price=23.0,
        stop_price=21.8,
        shares=5,
    )

    enriched, context = evaluator.evaluate(
        candidate,
        positions=[position],
        orders=[],
        account_size=1000.0,
        risk_pct_target=0.03,
        max_position_pct=0.6,
        min_shares=1,
        min_rr=2.0,
        max_fee_risk_pct=0.2,
    )

    assert enriched is candidate
    assert context.mode == "MANAGE_ONLY"
    assert candidate.recommendation is not None
    assert candidate.recommendation.costs.fee_to_risk_pct == pytest.approx(0.2167)
    fee_gate = next(
        gate
        for gate in candidate.recommendation.checklist
        if gate.gate_name == "fee_to_risk"
    )
    assert fee_gate.passed is False
    assert candidate.recommendation.decision_gates.plan.status == "BLOCK"
    assert candidate.recommendation.workflow_status == "needs_review"
    assert candidate.recommendation.next_step.code == "inspect_gate_conflict"


def test_same_symbol_adjusted_risk_preserves_missing_cross_currency_fx():
    recommendation = _make_recommendation()
    recommendation.risk.currency = "USD"
    recommendation.risk.account_currency = "EUR"
    recommendation.risk.account_to_quote_rate = None

    adjusted = _copy_recommendation_with_adjusted_risk(
        recommendation,
        execution_stop=19.63,
        shares=5,
        account_size=1000.0,
    )

    assert adjusted.risk.account_to_quote_rate is None
    assert adjusted.risk.risk_amount == 16.85
    assert adjusted.risk.risk_amount_account is None
    assert adjusted.risk.position_size_account is None
    assert adjusted.risk.risk_pct == 0.0
    assert adjusted.risk.target_source == "structural"
    assert adjusted.risk.desired_target == pytest.approx(25.76)


def test_same_symbol_reentry_converts_account_budget_for_cross_currency_add_on():
    evaluator = SameSymbolReentryEvaluator(_FakePortfolioService(action="NO_ACTION"))
    recommendation = _make_recommendation(entry=25.0, stop=23.0, shares=10)
    recommendation.risk.currency = "USD"
    recommendation.risk.account_currency = "EUR"
    recommendation.risk.account_to_quote_rate = 1.25
    candidate = _make_candidate()
    candidate.currency = "USD"
    candidate.close = 25.0
    candidate.entry = recommendation.risk.entry
    candidate.stop = recommendation.risk.stop
    candidate.target = recommendation.risk.target
    candidate.rr = recommendation.risk.rr
    candidate.shares = recommendation.risk.shares
    candidate.recommendation = recommendation
    position = make_position(
        ticker="REP.MC",
        position_id="POS-REP-1",
        entry_price=25.0,
        current_price=25.0,
        stop_price=20.0,
        shares=6,
    )

    enriched, context = evaluator.evaluate(
        candidate,
        positions=[position],
        orders=[],
        account_size=1000.0,
        risk_pct_target=0.03,
        max_position_pct=1.0,
        min_shares=1,
        min_rr=0.75,
    )

    assert enriched is not None
    assert context.mode == "ADD_ON"
    assert enriched.shares == 1
    assert enriched.recommendation is not None
    assert enriched.recommendation.risk.risk_amount == 5.0
    assert enriched.recommendation.risk.risk_amount_account == 4.0
    assert enriched.recommendation.risk.risk_pct == 0.004


def test_same_symbol_reentry_suppresses_when_pending_entry_exists():
    evaluator = SameSymbolReentryEvaluator(_FakePortfolioService())
    candidate = _make_candidate()
    position = make_position(
        ticker="REP.MC",
        position_id="POS-REP-1",
        entry_price=19.63,
        current_price=23.0,
        stop_price=19.63,
        shares=5,
    )
    pending_order = make_order(ticker="REP.MC", order_id="ORD-REP-PENDING")

    enriched, context = evaluator.evaluate(
        candidate,
        positions=[position],
        orders=[pending_order],
        account_size=500.0,
        risk_pct_target=0.03,
        max_position_pct=0.6,
        min_shares=1,
        min_rr=2.0,
    )

    assert enriched is not None
    assert enriched.same_symbol is context
    assert context.mode == "MANAGE_ONLY"
    assert context.pending_entry_exists is True
    assert context.reason == "A pending same-symbol entry already exists."


def test_same_symbol_reentry_allows_add_on_after_prior_filled_add_on():
    evaluator = SameSymbolReentryEvaluator(_FakePortfolioService(action="NO_ACTION"))
    candidate = _make_candidate()
    position = make_position(
        ticker="REP.MC",
        position_id="POS-REP-1",
        entry_price=19.63,
        current_price=23.0,
        stop_price=19.63,
        shares=10,
    )
    original_entry = make_order(
        ticker="REP.MC",
        order_id="ORD-REP-ENTRY-1",
        status="filled",
    )
    original_entry.position_id = "POS-REP-1"
    prior_add_on = make_order(
        ticker="REP.MC",
        order_id="ORD-REP-ADD-1",
        status="filled",
    )
    prior_add_on.position_id = "POS-REP-1"

    enriched, context = evaluator.evaluate(
        candidate,
        positions=[position],
        orders=[original_entry, prior_add_on],
        account_size=1000.0,
        risk_pct_target=0.03,
        max_position_pct=0.6,
        min_shares=1,
        min_rr=0.75,
    )

    assert enriched is not None
    assert context.mode == "ADD_ON"
    assert context.add_on_count == 1


def test_same_symbol_reentry_suppresses_close_state_positions():
    evaluator = SameSymbolReentryEvaluator(
        _FakePortfolioService(action="CLOSE_STOP_HIT")
    )
    candidate = _make_candidate()
    position = make_position(
        ticker="REP.MC",
        position_id="POS-REP-1",
        entry_price=19.63,
        current_price=23.0,
        stop_price=19.63,
        shares=5,
    )

    enriched, context = evaluator.evaluate(
        candidate,
        positions=[position],
        orders=[],
        account_size=500.0,
        risk_pct_target=0.03,
        max_position_pct=0.6,
        min_shares=1,
        min_rr=2.0,
    )

    assert enriched is not None
    assert enriched.same_symbol is context
    assert context.mode == "MANAGE_ONLY"
    assert context.reason == "Position is in a close state, so add-on is not allowed."
