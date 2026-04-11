from __future__ import annotations

import pytest

from api.models.screener import ScreenerCandidate
from swing_screener.recommendation.models import (
    DecisionSummary,
    DecisionDrivers,
    DecisionTradePlan,
    DecisionValuationContext,
)
from swing_screener.recommendation.priority import (
    CombinedPriorityConfig,
    compute_combined_priority,
)


def _candidate(
    ticker: str,
    *,
    confidence: float,
    rank: int,
    fundamentals_label: str = "neutral",
    catalyst_label: str = "neutral",
    valuation_label: str = "fair",
) -> ScreenerCandidate:
    ds = DecisionSummary(
        symbol=ticker,
        action="WATCH",
        conviction="medium",
        technical_label="neutral",
        fundamentals_label=fundamentals_label,  # type: ignore[arg-type]
        valuation_label=valuation_label,  # type: ignore[arg-type]
        catalyst_label=catalyst_label,  # type: ignore[arg-type]
        why_now="Context is constructive.",
        what_to_do="Keep it on the watchlist.",
        main_risk="No single input guarantees follow-through.",
        trade_plan=DecisionTradePlan(),
        valuation_context=DecisionValuationContext(),
        drivers=DecisionDrivers(),
    )
    return ScreenerCandidate(
        ticker=ticker,
        close=100.0,
        sma_20=98.0,
        sma_50=95.0,
        sma_200=90.0,
        atr=2.0,
        momentum_6m=0.10,
        momentum_12m=0.15,
        rel_strength=0.05,
        score=confidence / 100.0,
        confidence=confidence,
        rank=rank,
        decision_summary=ds,
    )


_CFG = CombinedPriorityConfig(
    technical_weight=0.45,
    fundamentals_weight=0.25,
    catalyst_weight=0.20,
    valuation_weight=0.10,
    prefilter_multiplier=3,
)


def test_catalyst_lifts_mid_ranked_candidate() -> None:
    """A mid-ranked technical candidate with strong catalyst + fundamentals should
    outrank the top technical candidate that has weak fundamentals and catalyst."""
    top = _candidate("TOP", confidence=100, rank=1, fundamentals_label="weak", catalyst_label="weak")
    mid = _candidate("MID", confidence=50, rank=2, fundamentals_label="strong", catalyst_label="active")
    low = _candidate("LOW", confidence=10, rank=3, fundamentals_label="weak", catalyst_label="weak")

    result = compute_combined_priority([top, mid, low], cfg=_CFG)

    assert result[0].ticker == "MID"


def test_weak_fundamentals_drops_top_technical_candidate() -> None:
    """The technically #1 candidate with weak fundamentals, weak catalyst, and expensive
    valuation should rank behind a near-peer with strong quality signals."""
    tech1 = _candidate(
        "TECH1", confidence=100, rank=1,
        fundamentals_label="weak", catalyst_label="weak", valuation_label="expensive"
    )
    tech2 = _candidate(
        "TECH2", confidence=80, rank=2,
        fundamentals_label="strong", catalyst_label="active", valuation_label="cheap"
    )
    # Third candidate anchors min for normalization.
    anchor = _candidate("ANCHOR", confidence=10, rank=3)

    result = compute_combined_priority([tech1, tech2, anchor], cfg=_CFG)

    assert result[0].ticker == "TECH2"


def test_raw_technical_rank_preserved() -> None:
    """Every output candidate must carry the original technical rank."""
    candidates = [
        _candidate("A", confidence=90, rank=1),
        _candidate("B", confidence=70, rank=2),
        _candidate("C", confidence=50, rank=3),
        _candidate("D", confidence=30, rank=4),
    ]

    result = compute_combined_priority(candidates, cfg=_CFG)

    raw_ranks = [c.raw_technical_rank for c in result]
    assert all(r is not None for r in raw_ranks)
    assert sorted(raw_ranks) == list(range(1, len(candidates) + 1))


def test_combined_priority_score_is_in_unit_interval() -> None:
    """combined_priority_score must be in [0, 1] for every candidate."""
    candidates = [
        _candidate("A", confidence=100, rank=1, fundamentals_label="strong", catalyst_label="active", valuation_label="cheap"),
        _candidate("B", confidence=60, rank=2, fundamentals_label="neutral", catalyst_label="neutral", valuation_label="fair"),
        _candidate("C", confidence=10, rank=3, fundamentals_label="weak", catalyst_label="weak", valuation_label="expensive"),
    ]

    result = compute_combined_priority(candidates, cfg=_CFG)

    for c in result:
        assert c.combined_priority_score is not None
        assert 0.0 <= c.combined_priority_score <= 1.0 + 1e-9
