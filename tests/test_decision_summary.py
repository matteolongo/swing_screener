from __future__ import annotations

import pytest

from api.models.screener import SameSymbolCandidateContext, ScreenerCandidate
from swing_screener.fundamentals.models import FundamentalPillarScore, FundamentalSnapshot
from swing_screener.intelligence.models import Opportunity
from swing_screener.recommendation import DecisionSummary, build_decision_summary


def _candidate(**overrides) -> ScreenerCandidate:
    payload = {
        "ticker": "AAPL",
        "currency": "USD",
        "close": 180.0,
        "sma_20": 175.0,
        "sma_50": 170.0,
        "sma_200": 160.0,
        "atr": 3.0,
        "momentum_6m": 0.18,
        "momentum_12m": 0.27,
        "rel_strength": 0.09,
        "score": 0.82,
        "confidence": 79.0,
        "rank": 1,
        "signal": "breakout",
        "entry": 180.0,
        "stop": 171.0,
        "target": 198.0,
        "rr": 2.0,
    }
    payload.update(overrides)
    return ScreenerCandidate(**payload)


def _snapshot(
    *,
    fundamentals_status: str = "strong",
    valuation_status: str = "neutral",
    coverage_status: str = "supported",
    freshness_status: str = "current",
    data_quality_status: str = "high",
    trailing_pe: float | None = 24.6,
    price_to_sales: float | None = 5.1,
    book_value_per_share: float | None = None,
    price_to_book: float | None = None,
    book_to_price: float | None = None,
) -> FundamentalSnapshot:
    score_map = {"strong": 0.9, "neutral": 0.55, "weak": 0.2}
    return FundamentalSnapshot(
        symbol="AAPL",
        asof_date="2026-03-19",
        provider="yfinance",
        updated_at="2026-03-19T08:00:00",
        coverage_status=coverage_status,
        freshness_status=freshness_status,
        data_quality_status=data_quality_status,
        trailing_pe=trailing_pe,
        price_to_sales=price_to_sales,
        book_value_per_share=book_value_per_share,
        price_to_book=price_to_book,
        book_to_price=book_to_price,
        pillars={
            "growth": FundamentalPillarScore(
                score=score_map[fundamentals_status],
                status=fundamentals_status,
                summary="Growth profile.",
            ),
            "profitability": FundamentalPillarScore(
                score=score_map[fundamentals_status],
                status=fundamentals_status,
                summary="Profitability profile.",
            ),
            "balance_sheet": FundamentalPillarScore(
                score=score_map[fundamentals_status],
                status=fundamentals_status,
                summary="Balance sheet profile.",
            ),
            "cash_flow": FundamentalPillarScore(
                score=score_map[fundamentals_status],
                status=fundamentals_status,
                summary="Cash-flow profile.",
            ),
            "valuation": FundamentalPillarScore(
                score=score_map[valuation_status],
                status=valuation_status,
                summary="Valuation profile.",
            ),
        },
    )


def _opportunity(
    *,
    technical_readiness: float = 0.82,
    catalyst_strength: float = 0.76,
    state: str = "TRENDING",
) -> Opportunity:
    return Opportunity(
        symbol="AAPL",
        technical_readiness=technical_readiness,
        catalyst_strength=catalyst_strength,
        opportunity_score=0.8,
        state=state,  # type: ignore[arg-type]
        explanations=["Catalyst remains active."],
        evidence_quality_flag="high",
    )


def test_decision_summary_round_trip() -> None:
    summary = build_decision_summary(_candidate(), opportunity=_opportunity(), fundamentals=_snapshot())

    payload = summary.model_dump()
    restored = DecisionSummary.model_validate(payload)

    assert restored == summary
    assert restored.trade_plan.rr == 2.0
    assert restored.valuation_context.method == "earnings_multiple"


def test_strong_technical_and_fundamentals_with_earnings_fair_value_maps_to_buy_now() -> None:
    summary = build_decision_summary(_candidate(), opportunity=_opportunity(), fundamentals=_snapshot())

    assert summary.action == "BUY_NOW"
    assert summary.conviction == "high"
    assert summary.technical_label == "strong"
    assert summary.fundamentals_label == "strong"
    assert summary.valuation_label == "fair"
    assert summary.valuation_context.method == "earnings_multiple"
    assert summary.valuation_context.fair_value_low == pytest.approx(171.22, abs=0.01)
    assert summary.valuation_context.fair_value_base == pytest.approx(193.17, abs=0.01)
    assert summary.valuation_context.fair_value_high == pytest.approx(215.12, abs=0.01)
    assert summary.valuation_context.premium_discount_pct == pytest.approx(-6.8, abs=0.1)
    assert "using earnings multiple" in summary.valuation_context.summary


def test_sales_multiple_fair_value_used_when_pe_is_missing() -> None:
    summary = build_decision_summary(
        _candidate(close=120.0),
        opportunity=_opportunity(),
        fundamentals=_snapshot(trailing_pe=None, price_to_sales=4.0),
    )

    assert summary.valuation_context.method == "sales_multiple"
    assert summary.valuation_context.fair_value_low == pytest.approx(141.52, abs=0.01)
    assert summary.valuation_context.fair_value_base == pytest.approx(166.5, abs=0.01)
    assert summary.valuation_context.fair_value_high == pytest.approx(191.47, abs=0.01)
    assert summary.valuation_context.premium_discount_pct == pytest.approx(-27.9, abs=0.1)
    assert "using sales multiple" in summary.valuation_context.summary


def test_book_multiple_fair_value_used_when_earnings_and_sales_are_missing() -> None:
    summary = build_decision_summary(
        _candidate(close=50.0),
        opportunity=_opportunity(),
        fundamentals=_snapshot(
            trailing_pe=None,
            price_to_sales=None,
            book_value_per_share=20.0,
            price_to_book=2.5,
            book_to_price=0.4,
        ),
    )

    assert summary.valuation_context.method == "book_multiple"
    assert summary.valuation_context.fair_value_low == pytest.approx(62.30, abs=0.01)
    assert summary.valuation_context.fair_value_base == pytest.approx(69.30, abs=0.01)
    assert summary.valuation_context.fair_value_high == pytest.approx(76.30, abs=0.01)
    assert summary.valuation_context.premium_discount_pct == pytest.approx(-27.8, abs=0.1)
    assert summary.valuation_context.book_value_per_share == 20.0
    assert summary.valuation_context.price_to_book == 2.5
    assert summary.valuation_context.book_to_price == 0.4
    assert "using book multiple" in summary.valuation_context.summary


def test_strong_technical_and_fundamentals_with_expensive_value_maps_to_buy_on_pullback() -> None:
    summary = build_decision_summary(
        _candidate(),
        opportunity=_opportunity(),
        fundamentals=_snapshot(valuation_status="weak"),
    )

    assert summary.action == "BUY_ON_PULLBACK"
    assert summary.valuation_label == "expensive"


def test_strong_fundamentals_with_weak_technicals_maps_to_watch() -> None:
    summary = build_decision_summary(
        _candidate(rr=1.1, confidence=42.0),
        opportunity=_opportunity(technical_readiness=0.2, catalyst_strength=0.3, state="WATCH"),
        fundamentals=_snapshot(),
    )

    assert summary.action == "WATCH"
    assert summary.technical_label == "weak"
    assert summary.fundamentals_label == "strong"


def test_strong_technicals_with_weak_fundamentals_maps_to_tactical_only() -> None:
    summary = build_decision_summary(
        _candidate(),
        opportunity=_opportunity(),
        fundamentals=_snapshot(fundamentals_status="weak"),
    )

    assert summary.action == "TACTICAL_ONLY"
    assert summary.fundamentals_label == "weak"


def test_weak_everything_maps_to_avoid() -> None:
    summary = build_decision_summary(
        _candidate(rr=1.0, confidence=35.0, signal=None, momentum_6m=-0.1, momentum_12m=-0.05, rel_strength=-0.02),
        opportunity=_opportunity(technical_readiness=0.15, catalyst_strength=0.1, state="QUIET"),
        fundamentals=_snapshot(fundamentals_status="weak", valuation_status="weak"),
    )

    assert summary.action == "AVOID"
    assert summary.conviction == "low"


def test_stale_partial_fundamentals_lower_conviction_and_add_warning() -> None:
    summary = build_decision_summary(
        _candidate(),
        opportunity=_opportunity(),
        fundamentals=_snapshot(
            coverage_status="partial",
            freshness_status="stale",
            data_quality_status="low",
        ),
    )

    assert summary.conviction == "medium"
    assert "Fundamental coverage is partial." in summary.drivers.warnings


def test_valuation_context_handles_missing_raw_multiples() -> None:
    summary = build_decision_summary(
        _candidate(),
        opportunity=_opportunity(),
        fundamentals=_snapshot(trailing_pe=None, price_to_sales=None, valuation_status="weak"),
    )

    assert summary.valuation_context.method == "not_available"
    assert summary.valuation_context.trailing_pe is None
    assert summary.valuation_context.price_to_sales is None
    assert summary.valuation_context.fair_value_base is None
    assert summary.valuation_context.summary == "Valuation looks demanding on current fundamentals."


def test_manage_only_context_maps_to_manage_only() -> None:
    summary = build_decision_summary(
        _candidate(
            same_symbol=SameSymbolCandidateContext(
                mode="MANAGE_ONLY",
                reason="Existing position already open.",
            )
        ),
        opportunity=_opportunity(),
        fundamentals=_snapshot(),
    )

    assert summary.action == "MANAGE_ONLY"
    assert summary.conviction == "low"
