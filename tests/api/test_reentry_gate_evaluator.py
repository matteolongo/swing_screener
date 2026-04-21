"""Tests for ReentryGateEvaluator."""
from __future__ import annotations

from api.models.recommendation import (
    ChecklistGate,
    Recommendation,
    RecommendationCosts,
    RecommendationEducation,
    RecommendationReason,
    RecommendationRisk,
)
from api.models.screener import PriorTradeContext, ScreenerCandidate
from api.services.reentry_gate_evaluator import ReentryGateEvaluator


def _make_recommendation(verdict: str = "RECOMMENDED", rr: float = 2.5) -> Recommendation:
    return Recommendation(
        verdict=verdict,
        reasons_short=["Valid setup"],
        reasons_detailed=[
            RecommendationReason(code="VALID", message="Setup is valid.", severity="info")
        ],
        risk=RecommendationRisk(
            entry=100.0,
            stop=95.0,
            target=110.0,
            rr=rr,
            risk_amount=25.0,
            risk_pct=0.0138,
            position_size=500.0,
            shares=5,
            invalidation_level=95.0,
        ),
        costs=RecommendationCosts(
            commission_estimate=0.0,
            fx_estimate=0.0,
            slippage_estimate=0.0,
            total_cost=0.0,
            fee_to_risk_pct=0.0,
        ),
        checklist=[ChecklistGate(gate_name="signal", passed=True, explanation="Signal active.")],
        education=RecommendationEducation(
            common_bias_warning="None",
            what_to_learn="Follow your plan.",
        ),
    )


def _make_candidate(
    ticker: str = "AAPL",
    rr: float = 2.5,
    stop: float = 95.0,
    recommendation: Recommendation | None = None,
) -> ScreenerCandidate:
    rec = recommendation if recommendation is not None else _make_recommendation(rr=rr)
    return ScreenerCandidate(
        ticker=ticker,
        close=100.0,
        sma_20=98.0,
        sma_50=95.0,
        sma_200=90.0,
        atr=3.0,
        momentum_6m=0.15,
        momentum_12m=0.20,
        rel_strength=1.1,
        score=0.8,
        confidence=75.0,
        rank=1,
        rr=rr,
        stop=stop,
        recommendation=rec,
        prior_trades=PriorTradeContext(
            last_exit_date="2026-03-01",
            last_exit_price=95.0,
            last_entry_price=100.0,
            last_r_outcome=-1.0,
            was_profitable=False,
            trade_count=1,
        ),
    )


def test_passes_all_checks_when_recommended_and_rr_sufficient():
    evaluator = ReentryGateEvaluator(rr_threshold=2.0)
    candidate = _make_candidate(rr=2.5)

    result = evaluator.evaluate([candidate])

    assert result[0].reentry_gate is not None
    assert result[0].reentry_gate.suppressed is False
    assert result[0].reentry_gate.checks["thesis_valid"].passed is True
    assert result[0].reentry_gate.checks["reward_sufficient"].passed is True


def test_suppresses_when_thesis_invalid():
    evaluator = ReentryGateEvaluator(rr_threshold=2.0)
    rec = _make_recommendation(verdict="NOT_RECOMMENDED", rr=2.5)
    candidate = _make_candidate(recommendation=rec)

    result = evaluator.evaluate([candidate])

    assert result[0].reentry_gate.suppressed is True
    assert result[0].reentry_gate.checks["thesis_valid"].passed is False


def test_suppresses_when_rr_below_threshold():
    evaluator = ReentryGateEvaluator(rr_threshold=2.0)
    rec = _make_recommendation(verdict="RECOMMENDED", rr=1.5)
    candidate = _make_candidate(rr=1.5, recommendation=rec)

    result = evaluator.evaluate([candidate])

    assert result[0].reentry_gate.suppressed is True
    assert result[0].reentry_gate.checks["reward_sufficient"].passed is False


def test_structural_checks_always_pass():
    evaluator = ReentryGateEvaluator(rr_threshold=2.0)
    candidate = _make_candidate(rr=2.5)

    result = evaluator.evaluate([candidate])

    checks = result[0].reentry_gate.checks
    assert checks["new_setup_present"].passed is True
    assert checks["stop_defined"].passed is True
    assert checks["position_size_reset"].passed is True
    assert checks["timeframe_fits"].passed is True


def test_candidates_without_prior_trades_skip_evaluation():
    evaluator = ReentryGateEvaluator(rr_threshold=2.0)
    candidate = _make_candidate(rr=2.5)
    candidate.prior_trades = None

    result = evaluator.evaluate([candidate])

    assert result[0].reentry_gate is None


def test_negative_catalyst_suppresses_market_context():
    evaluator = ReentryGateEvaluator(rr_threshold=2.0, upcoming_earnings_tickers={"AAPL"})
    candidate = _make_candidate(rr=2.5)

    result = evaluator.evaluate([candidate])

    assert result[0].reentry_gate.suppressed is True
    assert result[0].reentry_gate.checks["market_context_clean"].passed is False
