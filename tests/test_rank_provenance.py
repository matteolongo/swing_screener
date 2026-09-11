"""Regression tests for screener rank provenance (PR #455 follow-up).

Covers the hardened rank deserialization in
``api.services.screener_service._resolve_candidate_ranks`` and the explicit
``None`` (non-truthiness) technical-rank fallback used by the combined-priority
and decision-priority sort stages.

Contract under test::

    rank == legacy technical-selection alias
    technical_rank == technical-selection ordering
    confidence_rank == confidence-prefilter ordering
    priority_rank == final recommendation ordering
"""

from __future__ import annotations

from types import SimpleNamespace

import pandas as pd

from api.models.screener import ScreenerCandidate
from api.services.decision_context import apply_decision_priority_ranking
from api.services.screener_service import _resolve_candidate_ranks, _safe_rank
from swing_screener.recommendation.models import (
    DecisionDrivers,
    DecisionSummary,
    DecisionTradePlan,
    DecisionValuationContext,
)
from swing_screener.recommendation.priority import (
    CombinedPriorityConfig,
    compute_combined_priority,
)

# --- _safe_rank / _resolve_candidate_ranks ------------------------------------


def test_safe_rank_passes_through_valid_int() -> None:
    assert _safe_rank(2, 99) == 2


def test_safe_rank_coerces_numeric_string_like_legacy_int() -> None:
    # Parity with the previous int(...) convention: "5" still coerces.
    assert _safe_rank("5", 99) == 5


def test_safe_rank_falls_back_on_none_nan_and_garbage() -> None:
    assert _safe_rank(None, 7) == 7
    assert _safe_rank(float("nan"), 7) == 7
    assert _safe_rank("not-a-rank", 7) == 7


def test_legacy_input_without_technical_rank_column() -> None:
    rank, technical_rank, confidence_rank = _resolve_candidate_ranks(
        {"rank": 2}, position=9
    )
    assert rank == 2
    assert technical_rank == 2
    assert confidence_rank == 9


def test_explicit_technical_rank_keeps_provenance() -> None:
    rank, technical_rank, _ = _resolve_candidate_ranks(
        {"rank": 2, "technical_rank": 5}, position=9
    )
    assert rank == 2
    assert technical_rank == 5


def test_null_technical_rank_falls_back_to_legacy_rank() -> None:
    rank, technical_rank, _ = _resolve_candidate_ranks(
        {"rank": 3, "technical_rank": None}, position=9
    )
    assert rank == 3
    assert technical_rank == 3


def test_nan_technical_rank_in_dataframe_row_falls_back_to_legacy_rank() -> None:
    frame = pd.DataFrame({"rank": [3], "technical_rank": [float("nan")]}, index=["AAA"])
    rank, technical_rank, _ = _resolve_candidate_ranks(frame.iloc[0], position=1)
    assert rank == 3
    assert technical_rank == 3


def test_partially_populated_technical_rank_column() -> None:
    frame = pd.DataFrame(
        {"rank": [1, 3], "technical_rank": [7.0, float("nan")]},
        index=["AAA", "BBB"],
    )
    assert _resolve_candidate_ranks(frame.iloc[0], position=1)[:2] == (1, 7)
    assert _resolve_candidate_ranks(frame.iloc[1], position=2)[:2] == (3, 3)


def test_null_and_nan_confidence_rank_use_position_fallback() -> None:
    _, _, confidence_rank = _resolve_candidate_ranks(
        {"rank": 1, "technical_rank": 1, "confidence_rank": None}, position=4
    )
    assert confidence_rank == 4

    frame = pd.DataFrame(
        {
            "rank": [1],
            "technical_rank": [1],
            "confidence_rank": [float("nan")],
        },
        index=["AAA"],
    )
    _, _, confidence_rank = _resolve_candidate_ranks(frame.iloc[0], position=4)
    assert confidence_rank == 4


def test_malformed_ranks_are_never_silently_valid() -> None:
    rank, technical_rank, confidence_rank = _resolve_candidate_ranks(
        {"rank": "abc", "technical_rank": "xyz", "confidence_rank": "n/a"},
        position=6,
    )
    assert (rank, technical_rank, confidence_rank) == (6, 6, 6)


def test_missing_rank_keys_use_position_fallback() -> None:
    assert _resolve_candidate_ranks({}, position=6) == (6, 6, 6)


def test_attribute_style_test_double_with_only_rank() -> None:
    row = SimpleNamespace(rank=2)
    rank, technical_rank, confidence_rank = _resolve_candidate_ranks(row, position=9)
    assert rank == 2
    assert technical_rank == 2
    assert confidence_rank == 9


# --- sorting: primary criterion, then technical rank, then ticker ------------


def _decision_summary(
    ticker: str, *, action: str = "WATCH", conviction: str = "medium"
) -> DecisionSummary:
    return DecisionSummary(
        symbol=ticker,
        action=action,  # type: ignore[arg-type]
        conviction=conviction,  # type: ignore[arg-type]
        technical_label="neutral",  # type: ignore[arg-type]
        fundamentals_label="neutral",  # type: ignore[arg-type]
        valuation_label="fair",  # type: ignore[arg-type]
        catalyst_label="neutral",  # type: ignore[arg-type]
        why_now="Why now.",
        what_to_do="What to do.",
        main_risk="Main risk.",
        trade_plan=DecisionTradePlan(),
        valuation_context=DecisionValuationContext(),
        drivers=DecisionDrivers(),
    )


def _priority_candidate(
    ticker: str, *, confidence: float, rank: int, technical_rank: int | None = None
) -> ScreenerCandidate:
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
        technical_rank=technical_rank,
        decision_summary=_decision_summary(ticker),
    )


_CFG = CombinedPriorityConfig(
    technical_weight=0.45,
    fundamentals_weight=0.25,
    catalyst_weight=0.20,
    valuation_weight=0.10,
    prefilter_multiplier=3,
)


def test_combined_priority_breaks_score_ties_by_technical_rank_then_ticker() -> None:
    """Identical combined inputs must order by technical rank, then ticker."""
    candidates = [
        _priority_candidate("ZZZ", confidence=80, rank=9, technical_rank=2),
        _priority_candidate("MMM", confidence=80, rank=8, technical_rank=1),
        _priority_candidate("AAA", confidence=80, rank=7, technical_rank=1),
    ]

    result = compute_combined_priority(candidates, cfg=_CFG)

    assert [c.ticker for c in result] == ["AAA", "MMM", "ZZZ"]
    assert [c.raw_technical_rank for c in result] == [1, 1, 2]


def test_combined_priority_prefers_explicit_technical_rank_over_legacy_rank() -> None:
    """rank=2/technical_rank=5 must sort (and stamp) as technical rank 5."""
    legacy_first = _priority_candidate("LEGACY", confidence=80, rank=1)
    explicit_fifth = _priority_candidate(
        "EXPLICIT", confidence=80, rank=2, technical_rank=5
    )
    anchor = _priority_candidate("ANCHOR", confidence=80, rank=3, technical_rank=9)

    result = compute_combined_priority([explicit_fifth, anchor, legacy_first], cfg=_CFG)

    assert [c.ticker for c in result] == ["LEGACY", "EXPLICIT", "ANCHOR"]
    by_ticker = {c.ticker: c for c in result}
    assert by_ticker["LEGACY"].raw_technical_rank == 1
    assert by_ticker["LEGACY"].rank == 1
    assert by_ticker["EXPLICIT"].raw_technical_rank == 5
    assert by_ticker["EXPLICIT"].rank == 2


def test_decision_priority_uses_technical_rank_with_ticker_tie_break() -> None:
    """Same action/conviction/confidence must order by technical rank, then ticker."""
    candidates = [
        _priority_candidate("ZZZ", confidence=80, rank=9, technical_rank=2).model_copy(
            update={
                "ticker": "ZZZ",
                "decision_summary": _decision_summary(
                    "ZZZ", action="BUY_NOW", conviction="high"
                ),
            }
        ),
        _priority_candidate("MMM", confidence=80, rank=8, technical_rank=1).model_copy(
            update={
                "ticker": "MMM",
                "decision_summary": _decision_summary(
                    "MMM", action="BUY_NOW", conviction="high"
                ),
            }
        ),
        _priority_candidate("AAA", confidence=80, rank=7, technical_rank=1).model_copy(
            update={
                "ticker": "AAA",
                "decision_summary": _decision_summary(
                    "AAA", action="BUY_NOW", conviction="high"
                ),
            }
        ),
    ]

    prioritized = apply_decision_priority_ranking(candidates)

    assert [c.ticker for c in prioritized] == ["AAA", "MMM", "ZZZ"]
    assert [c.priority_rank for c in prioritized] == [1, 2, 3]
    # Legacy rank provenance is untouched by the priority stage.
    assert [c.rank for c in prioritized] == [7, 8, 9]


def test_decision_priority_falls_back_to_legacy_rank_when_technical_rank_is_none() -> (
    None
):
    legacy = _priority_candidate("LEGACY", confidence=80, rank=1).model_copy(
        update={
            "decision_summary": _decision_summary(
                "LEGACY", action="BUY_NOW", conviction="high"
            )
        }
    )
    explicit = _priority_candidate(
        "EXPLICIT", confidence=80, rank=9, technical_rank=2
    ).model_copy(
        update={
            "decision_summary": _decision_summary(
                "EXPLICIT", action="BUY_NOW", conviction="high"
            )
        }
    )
    assert legacy.technical_rank is None

    prioritized = apply_decision_priority_ranking([explicit, legacy])

    assert [c.ticker for c in prioritized] == ["LEGACY", "EXPLICIT"]
    assert [c.priority_rank for c in prioritized] == [1, 2]
