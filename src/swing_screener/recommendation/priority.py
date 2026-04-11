from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from swing_screener.settings import get_settings_manager


def _priority_defaults() -> dict:
    sel = get_settings_manager().get_low_level_defaults_payload("selection")
    d = sel.get("combined_priority", {})
    return d if isinstance(d, dict) else {}


@dataclass(frozen=True)
class CombinedPriorityConfig:
    technical_weight: float = field(default_factory=lambda: float(_priority_defaults().get("technical_weight", 0.45)))
    fundamentals_weight: float = field(default_factory=lambda: float(_priority_defaults().get("fundamentals_weight", 0.25)))
    catalyst_weight: float = field(default_factory=lambda: float(_priority_defaults().get("catalyst_weight", 0.20)))
    valuation_weight: float = field(default_factory=lambda: float(_priority_defaults().get("valuation_weight", 0.10)))
    prefilter_multiplier: int = field(default_factory=lambda: int(_priority_defaults().get("prefilter_multiplier", 3)))


_FUNDAMENTALS_SCORE: dict[str, float] = {"strong": 1.0, "neutral": 0.5, "weak": 0.0}
_CATALYST_SCORE: dict[str, float] = {"active": 1.0, "neutral": 0.5, "weak": 0.0}
_VALUATION_SCORE: dict[str, float] = {"cheap": 1.0, "fair": 0.5, "expensive": 0.0, "unknown": 0.5}


def _get(source: Any, key: str, default: Any = None) -> Any:
    if source is None:
        return default
    if isinstance(source, dict):
        return source.get(key, default)
    return getattr(source, key, default)


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def compute_combined_priority(
    candidates: list[Any],
    cfg: CombinedPriorityConfig = CombinedPriorityConfig(),
) -> list[Any]:
    """
    Re-rank candidates using a blended score that incorporates technical confidence,
    fundamentals quality, catalyst strength, and valuation attractiveness.

    For each candidate, attempts to read `decision_summary` for label-based sub-scores.
    Falls back to neutral (0.5) when a label is absent.

    New fields set on each candidate dict (if candidates are dicts):
      - raw_technical_rank: original rank before combined scoring
      - combined_priority_score: final blended score in [0, 1]

    For dataclass / object candidates the fields are set as attributes if possible.

    Returns candidates sorted descending by combined_priority_score.
    """
    if not candidates:
        return candidates

    # Normalise technical confidence to [0, 1] via min-max
    confidences = [_safe_float(_get(c, "confidence")) for c in candidates]
    valid_conf = [v for v in confidences if v is not None]
    conf_min = min(valid_conf) if valid_conf else 0.0
    conf_max = max(valid_conf) if valid_conf else 100.0
    conf_range = conf_max - conf_min if conf_max > conf_min else 1.0

    wt = cfg.technical_weight
    wf = cfg.fundamentals_weight
    wc = cfg.catalyst_weight
    wv = cfg.valuation_weight
    total_w = wt + wf + wc + wv or 1.0

    scored: list[tuple[float, int, Any]] = []
    for i, candidate in enumerate(candidates):
        raw_rank = _safe_float(_get(candidate, "rank")) or float(i + 1)

        conf = confidences[i]
        tech_score = ((conf - conf_min) / conf_range) if conf is not None else 0.5

        ds = _get(candidate, "decision_summary")
        fund_label = str(_get(ds, "fundamentals_label", "neutral") or "neutral").lower()
        cat_label = str(_get(ds, "catalyst_label", "neutral") or "neutral").lower()
        val_label = str(_get(ds, "valuation_label", "unknown") or "unknown").lower()

        fund_score = _FUNDAMENTALS_SCORE.get(fund_label, 0.5)
        cat_score = _CATALYST_SCORE.get(cat_label, 0.5)
        val_score = _VALUATION_SCORE.get(val_label, 0.5)

        # Apply freshness and coverage penalties from business_quality_score if available
        snap = _get(candidate, "fundamentals_snapshot")
        if snap is not None:
            bqs = _safe_float(_get(snap, "business_quality_score"))
            if bqs is not None:
                fund_score = bqs  # use richer quality score when available
            freshness_pen = _safe_float(_get(snap, "freshness_penalty")) or 0.0
            coverage_pen = _safe_float(_get(snap, "coverage_penalty")) or 0.0
            # Penalties reduce the fundamentals contribution proportionally
            fund_score = fund_score * max(0.0, 1.0 - freshness_pen - coverage_pen * 0.5)

        combined = (wt * tech_score + wf * fund_score + wc * cat_score + wv * val_score) / total_w
        scored.append((combined, int(raw_rank), candidate))

    scored.sort(key=lambda t: (-t[0], t[1]))

    result: list[Any] = []
    for priority_rank, (combined_score, _raw_rank, candidate) in enumerate(scored, start=1):
        raw_technical_rank = _safe_float(_get(candidate, "rank")) or float(priority_rank)
        if isinstance(candidate, dict):
            candidate = dict(candidate)
            candidate["raw_technical_rank"] = int(raw_technical_rank)
            candidate["combined_priority_score"] = round(combined_score, 4)
        else:
            try:
                object.__setattr__(candidate, "raw_technical_rank", int(raw_technical_rank))
                object.__setattr__(candidate, "combined_priority_score", round(combined_score, 4))
            except (AttributeError, TypeError):
                pass
        result.append(candidate)

    return result
