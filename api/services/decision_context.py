"""Decision-context enrichment helpers for screener candidates.

Fundamentals snapshot loading and decision-priority ranking. These operate on
API models (``ScreenerCandidate``/``Recommendation``) and call into fundamentals
storage and the risk engine, so they live in the API layer rather than core.
Extracted from ``screener_service`` to keep that module a thin orchestrator.
"""

from __future__ import annotations

from api.models.screener import ScreenerCandidate
from swing_screener.fundamentals.storage import FundamentalsStorage
from swing_screener.recommendation import build_decision_summary

DECISION_ACTION_PRIORITY = {
    "BUY_NOW": 6,
    "BUY_ON_PULLBACK": 5,
    "WAIT_FOR_BREAKOUT": 4,
    "WATCH": 3,
    "TACTICAL_ONLY": 2,
    "MANAGE_ONLY": 1,
    "AVOID": 0,
}
DECISION_CONVICTION_PRIORITY = {
    "high": 2,
    "medium": 1,
    "low": 0,
}


def fundamentals_summary(snapshot) -> str | None:
    for value in getattr(snapshot, "highlights", []) or []:
        text = str(value).strip()
        if text:
            return text
    for value in getattr(snapshot, "red_flags", []) or []:
        text = str(value).strip()
        if text:
            return text
    error = getattr(snapshot, "error", None)
    if error:
        text = str(error).strip()
        if text:
            return text
    return None


def load_fundamentals_snapshots(
    candidates: list[ScreenerCandidate],
    *,
    storage: FundamentalsStorage | None = None,
) -> dict[str, object]:
    """Load each unique candidate ticker's snapshot once (None when missing)."""
    fundamentals_storage = storage or FundamentalsStorage()
    return {
        ticker: fundamentals_storage.load_snapshot(ticker)
        for ticker in {c.ticker for c in candidates}
    }


def apply_cached_fundamentals_context(
    candidates: list[ScreenerCandidate],
    *,
    snapshots: dict[str, object] | None = None,
    storage: FundamentalsStorage | None = None,
) -> list[ScreenerCandidate]:
    if not candidates:
        return candidates
    snapshot_cache = (
        snapshots
        if snapshots is not None
        else load_fundamentals_snapshots(candidates, storage=storage)
    )
    enriched: list[ScreenerCandidate] = []
    for candidate in candidates:
        snapshot = snapshot_cache.get(candidate.ticker)
        if snapshot is None:
            enriched.append(candidate)
            continue
        enriched.append(
            candidate.model_copy(
                update={
                    "fundamentals_coverage_status": getattr(
                        snapshot, "coverage_status", None
                    ),
                    "fundamentals_freshness_status": getattr(
                        snapshot, "freshness_status", None
                    ),
                    "fundamentals_summary": fundamentals_summary(snapshot),
                }
            )
        )
    return enriched


def apply_decision_summary_context(
    candidates: list[ScreenerCandidate],
    *,
    snapshots: dict[str, object] | None = None,
    fundamentals_storage: FundamentalsStorage | None = None,
) -> list[ScreenerCandidate]:
    if not candidates:
        return candidates

    snapshot_cache = (
        snapshots
        if snapshots is not None
        else load_fundamentals_snapshots(candidates, storage=fundamentals_storage)
    )

    enriched: list[ScreenerCandidate] = []
    for candidate in candidates:
        fund_snap = snapshot_cache.get(candidate.ticker)
        fund_asof = (
            getattr(fund_snap, "asof_date", None) if fund_snap is not None else None
        )
        opportunity = None
        enriched.append(
            candidate.model_copy(
                update={
                    "decision_summary": build_decision_summary(
                        candidate,
                        opportunity=opportunity,
                        fundamentals=fund_snap,
                    ),
                    "fundamentals_snapshot": fund_snap,
                    "fundamentals_asof": str(fund_asof) if fund_asof else None,
                    "intelligence_asof": (
                        opportunity.generated_at if opportunity else None
                    ),
                }
            )
        )
    return enriched


def _technical_rank(candidate: ScreenerCandidate) -> int:
    """Explicit-``None`` compatibility fallback: ``technical_rank`` wins when
    present, otherwise legacy ``rank`` (which aliases the technical order)."""
    return (
        candidate.technical_rank
        if candidate.technical_rank is not None
        else candidate.rank
    )


def apply_decision_priority_ranking(
    candidates: list[ScreenerCandidate],
) -> list[ScreenerCandidate]:
    if not candidates:
        return candidates

    # Keep the raw screener rank intact and use decision action + conviction as an additive ordering layer.
    ordered = sorted(
        candidates,
        key=lambda candidate: (
            -DECISION_ACTION_PRIORITY.get(
                getattr(getattr(candidate, "decision_summary", None), "action", ""),
                -1,
            ),
            -DECISION_CONVICTION_PRIORITY.get(
                getattr(getattr(candidate, "decision_summary", None), "conviction", ""),
                -1,
            ),
            _technical_rank(candidate),
            -candidate.confidence,
            candidate.ticker,
        ),
    )
    return [
        candidate.model_copy(update={"priority_rank": index})
        for index, candidate in enumerate(ordered, start=1)
    ]
