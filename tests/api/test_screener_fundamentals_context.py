from __future__ import annotations

from api.models.screener import ScreenerCandidate
from api.services.screener_service import (
    _apply_cached_fundamentals_context,
    _apply_decision_priority_ranking,
    _apply_decision_summary_context,
)
from swing_screener.fundamentals.models import FundamentalPillarScore
from swing_screener.fundamentals.models import FundamentalSnapshot
from swing_screener.fundamentals.storage import FundamentalsStorage
from swing_screener.intelligence.models import Opportunity
from swing_screener.intelligence.storage import IntelligenceStorage
from swing_screener.recommendation.models import DecisionSummary


def _candidate() -> ScreenerCandidate:
    return ScreenerCandidate(
        ticker="AAPL",
        currency="USD",
        close=180.0,
        sma_20=175.0,
        sma_50=170.0,
        sma_200=160.0,
        atr=3.0,
        momentum_6m=0.2,
        momentum_12m=0.3,
        rel_strength=1.1,
        score=0.82,
        confidence=79.0,
        rank=1,
    )


def test_apply_cached_fundamentals_context_uses_snapshot_summary(tmp_path):
    storage = FundamentalsStorage(tmp_path / "fundamentals")
    storage.save_snapshot(
        FundamentalSnapshot(
            symbol="AAPL",
            asof_date="2026-03-19",
            provider="yfinance",
            updated_at="2026-03-19T09:00:00",
            coverage_status="supported",
            freshness_status="current",
            highlights=["Growth metrics are supportive."],
        )
    )

    enriched = _apply_cached_fundamentals_context([_candidate()], storage=storage)

    assert enriched[0].fundamentals_coverage_status == "supported"
    assert enriched[0].fundamentals_freshness_status == "current"
    assert enriched[0].fundamentals_summary == "Growth metrics are supportive."


def test_apply_decision_summary_context_combines_fundamentals_and_intelligence(tmp_path):
    fundamentals_storage = FundamentalsStorage(tmp_path / "fundamentals")
    intelligence_storage = IntelligenceStorage(tmp_path / "intelligence")

    fundamentals_storage.save_snapshot(
        FundamentalSnapshot(
            symbol="AAPL",
            asof_date="2026-03-19",
            provider="yfinance",
            updated_at="2026-03-19T09:00:00",
            coverage_status="supported",
            freshness_status="current",
            data_quality_status="high",
            trailing_pe=21.4,
            price_to_sales=4.3,
            pillars={
                "growth": FundamentalPillarScore(score=0.9, status="strong", summary="Growth profile."),
                "profitability": FundamentalPillarScore(score=0.9, status="strong", summary="Profitability profile."),
                "balance_sheet": FundamentalPillarScore(score=0.9, status="strong", summary="Balance sheet profile."),
                "cash_flow": FundamentalPillarScore(score=0.9, status="strong", summary="Cash-flow profile."),
                "valuation": FundamentalPillarScore(score=0.55, status="neutral", summary="Valuation profile."),
            },
        )
    )
    intelligence_storage.write_opportunities(
        [
            Opportunity(
                symbol="AAPL",
                technical_readiness=0.84,
                catalyst_strength=0.74,
                opportunity_score=0.81,
                state="TRENDING",
                explanations=["Catalyst support is active."],
                evidence_quality_flag="high",
            )
        ],
        "2026-03-19",
    )

    enriched = _apply_decision_summary_context(
        [_candidate()],
        fundamentals_storage=fundamentals_storage,
        intelligence_storage=intelligence_storage,
    )

    assert enriched[0].decision_summary is not None
    assert enriched[0].decision_summary.action == "BUY_NOW"
    assert enriched[0].decision_summary.catalyst_label == "active"
    assert enriched[0].decision_summary.valuation_context.method == "earnings_multiple"
    assert enriched[0].decision_summary.valuation_context.fair_value_base is not None
    assert enriched[0].decision_summary.valuation_context.premium_discount_pct is not None
    assert "Trailing PE is 21.4x" in enriched[0].decision_summary.valuation_context.summary


def test_apply_decision_priority_ranking_uses_action_then_conviction_then_raw_rank() -> None:
    watch_candidate = _candidate().model_copy(
        update={
            "ticker": "WATCH",
            "rank": 1,
            "decision_summary": DecisionSummary(
                symbol="WATCH",
                action="WATCH",
                conviction="high",
                technical_label="neutral",
                fundamentals_label="neutral",
                valuation_label="fair",
                catalyst_label="neutral",
                why_now="Watch it.",
                what_to_do="Wait.",
                main_risk="Not ready.",
            ),
        }
    )
    buy_now_medium = _candidate().model_copy(
        update={
            "ticker": "MEDIUM",
            "rank": 3,
            "decision_summary": DecisionSummary(
                symbol="MEDIUM",
                action="BUY_NOW",
                conviction="medium",
                technical_label="strong",
                fundamentals_label="strong",
                valuation_label="fair",
                catalyst_label="active",
                why_now="Ready.",
                what_to_do="Act.",
                main_risk="Execution.",
            ),
        }
    )
    buy_now_high = _candidate().model_copy(
        update={
            "ticker": "HIGH",
            "rank": 4,
            "decision_summary": DecisionSummary(
                symbol="HIGH",
                action="BUY_NOW",
                conviction="high",
                technical_label="strong",
                fundamentals_label="strong",
                valuation_label="cheap",
                catalyst_label="active",
                why_now="Very ready.",
                what_to_do="Act first.",
                main_risk="Execution.",
            ),
        }
    )

    prioritized = _apply_decision_priority_ranking([watch_candidate, buy_now_medium, buy_now_high])

    assert [candidate.ticker for candidate in prioritized] == ["HIGH", "MEDIUM", "WATCH"]
    assert [candidate.priority_rank for candidate in prioritized] == [1, 2, 3]
    assert [candidate.rank for candidate in prioritized] == [4, 3, 1]
