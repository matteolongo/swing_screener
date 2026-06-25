"""Decision-context enrichment helpers for screener candidates.

Fundamentals snapshot loading, decision-summary context, recommendation rebuild
keyed off the decision action, and decision-priority ranking. These operate on
API models (``ScreenerCandidate``/``Recommendation``) and call into fundamentals
storage and the risk engine, so they live in the API layer rather than core.
Extracted from ``screener_service`` to keep that module a thin orchestrator.
"""
from __future__ import annotations

from dataclasses import asdict
import logging

from api.models.screener import ScreenerCandidate
from api.models.recommendation import Recommendation
from swing_screener.fundamentals.storage import FundamentalsStorage
from swing_screener.recommendation import build_decision_summary
from swing_screener.risk.engine import RiskEngineConfig, evaluate_recommendation

logger = logging.getLogger(__name__)

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
                    "fundamentals_coverage_status": getattr(snapshot, "coverage_status", None),
                    "fundamentals_freshness_status": getattr(snapshot, "freshness_status", None),
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
        fund_asof = getattr(fund_snap, "asof_date", None) if fund_snap is not None else None
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
                    "intelligence_asof": opportunity.generated_at if opportunity else None,
                }
            )
        )
    return enriched


def rebuild_recommendations_with_decision_action(
    candidates: list[ScreenerCandidate],
    *,
    risk_cfg,
    rr_target: float,
    commission_pct: float,
) -> list[ScreenerCandidate]:
    """Rebuild each candidate's recommendation using the decision_summary action as the
    signal input so that the Order tab verdict is consistent with the decision badge."""
    if not candidates:
        return candidates

    rebuilt: list[ScreenerCandidate] = []
    for candidate in candidates:
        action = getattr(getattr(candidate, "decision_summary", None), "action", None)
        if not action:
            rebuilt.append(candidate)
            continue

        rec = candidate.recommendation
        if rec is None:
            rebuilt.append(candidate)
            continue

        # Only rebuild when the original recommendation already failed signal_active.
        # This prevents demoting a RECOMMENDED candidate that already has a chart signal.
        signal_gate_passed = any(
            gate.gate_name == "signal_active" and gate.passed
            for gate in (rec.checklist or [])
        )
        if signal_gate_passed:
            rebuilt.append(candidate)
            continue

        # Rebuild using decision action as signal so signal_active reflects the full picture.
        logger.debug(
            "Rebuilding recommendation for %s: signal_active was False, decision_summary.action=%s",
            candidate.ticker,
            action,
        )
        new_rec_payload = evaluate_recommendation(
            signal=action,
            entry=rec.risk.entry if rec.risk else None,
            stop=rec.risk.stop if rec.risk else None,
            shares=rec.risk.shares if rec.risk else None,
            risk_cfg=risk_cfg,
            rr_target=rr_target,
            costs=RiskEngineConfig(
                commission_pct=commission_pct,
                slippage_bps=5.0,
                fx_estimate_pct=0.0,
            ),
            ticker=candidate.ticker,
            strategy="Momentum",
            close=candidate.close,
            sma_20=candidate.sma_20,
            sma_50=candidate.sma_50,
            sma_200=candidate.sma_200,
            atr=candidate.atr,
            momentum_6m=candidate.momentum_6m,
            momentum_12m=candidate.momentum_12m,
            rel_strength=candidate.rel_strength,
            confidence=candidate.confidence,
        )
        rebuilt.append(
            candidate.model_copy(
                update={"recommendation": Recommendation.model_validate(asdict(new_rec_payload))}
            )
        )
    return rebuilt


def apply_decision_priority_ranking(candidates: list[ScreenerCandidate]) -> list[ScreenerCandidate]:
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
            candidate.rank,
            -candidate.confidence,
            candidate.ticker,
        ),
    )
    return [
        candidate.model_copy(update={"priority_rank": index})
        for index, candidate in enumerate(ordered, start=1)
    ]
