"""Combined priority scoring for screener candidates.

Two-stage ranking pipeline:
  Stage 1 — technical prefilter (top_n × prefilter_multiplier candidates)
  Stage 2 — combined priority: blends technical + fundamentals + catalyst + valuation

All weights are configurable via ``selection.combined_priority`` in defaults.yaml.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from api.models.screener import ScreenerCandidate


def _combined_priority_defaults() -> dict:
    from swing_screener.settings import get_settings_manager

    sel = get_settings_manager().get_low_level_defaults_payload("selection")
    d = sel.get("combined_priority", {})
    return d if isinstance(d, dict) else {}


@dataclass(frozen=True)
class CombinedPriorityConfig:
    technical_weight: float = field(
        default_factory=lambda: float(_combined_priority_defaults().get("technical_weight", 0.45))
    )
    fundamentals_weight: float = field(
        default_factory=lambda: float(_combined_priority_defaults().get("fundamentals_weight", 0.25))
    )
    catalyst_weight: float = field(
        default_factory=lambda: float(_combined_priority_defaults().get("catalyst_weight", 0.20))
    )
    valuation_weight: float = field(
        default_factory=lambda: float(_combined_priority_defaults().get("valuation_weight", 0.10))
    )
    prefilter_multiplier: int = field(
        default_factory=lambda: int(_combined_priority_defaults().get("prefilter_multiplier", 3))
    )


# Label → sub-score mappings (0..1, higher is better).
_FUNDAMENTALS_SCORE: dict[str, float] = {
    "strong": 1.0,
    "neutral": 0.5,
    "weak": 0.0,
}
_CATALYST_SCORE: dict[str, float] = {
    "active": 1.0,
    "neutral": 0.5,
    "weak": 0.0,
}
_VALUATION_SCORE: dict[str, float] = {
    "cheap": 1.0,
    "fair": 0.5,
    "expensive": 0.0,
    "unknown": 0.5,
}


def _label_score(mapping: dict[str, float], label: str | None, default: float = 0.5) -> float:
    return mapping.get((label or "").lower(), default)


def compute_combined_priority(
    candidates: list[ScreenerCandidate],
    cfg: CombinedPriorityConfig = CombinedPriorityConfig(),
) -> list[ScreenerCandidate]:
    """Sort *candidates* by combined priority score (descending).

    For each candidate:
    - Stamps ``raw_technical_rank`` from its current ``rank`` field.
    - Computes ``combined_priority_score`` in [0, 1].

    The caller is responsible for slicing the returned list to the desired final top-N.
    Penalties (freshness, data quality) are reserved for PR6/PR7 and currently 0.0.
    """
    if not candidates:
        return candidates

    # --- normalize technical readiness (min-max over batch) --------------------
    confidences = [c.confidence for c in candidates]
    conf_min = min(confidences)
    conf_max = max(confidences)
    conf_range = conf_max - conf_min

    def _tech(conf: float) -> float:
        if conf_range == 0:
            return 0.5
        return (conf - conf_min) / conf_range

    # --- compute per-candidate scores ------------------------------------------
    scored: list[tuple[ScreenerCandidate, float]] = []
    for candidate in candidates:
        ds = candidate.decision_summary

        tech = _tech(candidate.confidence)
        fund = _label_score(
            _FUNDAMENTALS_SCORE,
            getattr(ds, "fundamentals_label", None) if ds else None,
        )
        catalyst = _label_score(
            _CATALYST_SCORE,
            getattr(ds, "catalyst_label", None) if ds else None,
        )
        valuation = _label_score(
            _VALUATION_SCORE,
            getattr(ds, "valuation_label", None) if ds else None,
        )

        # Penalties reserved for PR6/PR7.
        freshness_penalty = 0.0
        data_quality_penalty = 0.0

        combined = (
            cfg.technical_weight * tech
            + cfg.fundamentals_weight * fund
            + cfg.catalyst_weight * catalyst
            + cfg.valuation_weight * valuation
            - freshness_penalty
            - data_quality_penalty
        )
        # Clamp to [0, 1] to guard against future penalty values.
        combined = max(0.0, min(1.0, combined))

        scored.append((candidate, combined))

    # --- sort descending -------------------------------------------------------
    scored.sort(key=lambda t: t[1], reverse=True)

    # --- stamp fields on output candidates ------------------------------------
    result: list[ScreenerCandidate] = []
    for candidate, score in scored:
        result.append(
            candidate.model_copy(
                update={
                    "raw_technical_rank": candidate.rank,
                    "combined_priority_score": round(score, 6),
                }
            )
        )

    return result
