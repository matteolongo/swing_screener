from __future__ import annotations

from types import SimpleNamespace

from api.models.recommendation import (
    ChecklistGate,
    Recommendation,
    RecommendationCosts,
    RecommendationEducation,
    RecommendationReason,
    RecommendationRisk,
)
from api.models.screener import ScreenerCandidate
from api.services.same_symbol_reentry import SameSymbolReentryEvaluator
from tests.api._chat_test_helpers import make_order, make_position


def _make_recommendation(*, verdict: str = "RECOMMENDED", entry: float = 23.0, stop: float = 21.62, shares: int = 5) -> Recommendation:
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
        checklist=[ChecklistGate(gate_name="signal", passed=True, explanation="Signal active.")],
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
    )

    assert enriched is not None
    assert context.mode == "ADD_ON"
    assert enriched.same_symbol is not None
    assert enriched.same_symbol.current_position_stop == 19.63
    assert enriched.same_symbol.fresh_setup_stop == 21.62
    assert enriched.stop == 19.63
    assert enriched.recommendation is not None
    assert enriched.recommendation.risk.stop == 19.63
    assert enriched.shares == 5
    assert "Live stop 19.63 is used for execution" in (enriched.execution_note or "")


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
    )

    assert enriched is None
    assert context.mode == "MANAGE_ONLY"
    assert context.pending_entry_exists is True
    assert context.reason == "A pending same-symbol entry already exists."


def test_same_symbol_reentry_suppresses_close_state_positions():
    evaluator = SameSymbolReentryEvaluator(_FakePortfolioService(action="CLOSE_STOP_HIT"))
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
    )

    assert enriched is None
    assert context.mode == "MANAGE_ONLY"
    assert context.reason == "Position is in a close state, so add-on is not allowed."
