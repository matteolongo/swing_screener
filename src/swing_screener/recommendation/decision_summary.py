from __future__ import annotations

from typing import Any

from swing_screener.fundamentals.models import FundamentalPillarScore, FundamentalSnapshot
from swing_screener.intelligence.models import Opportunity
from swing_screener.recommendation.models import (
    CatalystLabel,
    DecisionAction,
    DecisionConviction,
    DecisionDrivers,
    DecisionSummary,
    DecisionTradePlan,
    DecisionValuationContext,
    SignalLabel,
    ValuationLabel,
)

_ACTION_WHY_NOW: dict[DecisionAction, str] = {
    "BUY_NOW": "Setup timing is ready and the business-quality read supports conviction.",
    "BUY_ON_PULLBACK": "Setup quality is strong, but valuation pressure argues against chasing strength.",
    "WAIT_FOR_BREAKOUT": "Context is constructive, but the setup still needs cleaner confirmation.",
    "WATCH": "There is something to like here, but the full setup is not ready yet.",
    "TACTICAL_ONLY": "Chart conditions are tradable, but the business-quality read is weak for higher-conviction holds.",
    "AVOID": "Technical and fundamental evidence do not show a strong edge right now.",
    "MANAGE_ONLY": "This symbol is already in play, so the priority is managing existing risk instead of adding fresh exposure.",
}

_ACTION_WHAT_TO_DO: dict[DecisionAction, str] = {
    "BUY_NOW": "Use the current trade plan and keep sizing inside your normal risk budget.",
    "BUY_ON_PULLBACK": "Prefer a disciplined pullback or very controlled breakout entry instead of chasing.",
    "WAIT_FOR_BREAKOUT": "Keep it on the active list and wait for cleaner confirmation before entry.",
    "WATCH": "Keep it on the watchlist and wait for either stronger timing or better supporting data.",
    "TACTICAL_ONLY": "Treat this as a shorter-term tactical setup and keep conviction and holding assumptions lower.",
    "AVOID": "De-prioritize this symbol until either the chart or the underlying quality improves.",
    "MANAGE_ONLY": "Manage the existing position or pending order instead of opening a new setup.",
}


def _get_value(source: Any, key: str, default: Any = None) -> Any:
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


def _normalize_percent(value: Any) -> float | None:
    numeric = _safe_float(value)
    if numeric is None:
        return None
    return numeric * 100 if abs(numeric) <= 1 else numeric


def _append_unique(target: list[str], value: str | None, *, limit: int = 2) -> None:
    text = " ".join(str(value or "").split()).strip()
    if not text or text in target or len(target) >= limit:
        return
    target.append(text)


def _pillar(snapshot: FundamentalSnapshot | None, key: str) -> FundamentalPillarScore | None:
    if snapshot is None:
        return None
    pillar = snapshot.pillars.get(key)
    return pillar if isinstance(pillar, FundamentalPillarScore) else None


def _score_from_status(status: str | None) -> float | None:
    normalized = str(status or "").strip().lower()
    if normalized == "strong":
        return 1.0
    if normalized == "neutral":
        return 0.55
    if normalized == "weak":
        return 0.0
    return None


def _average(values: list[float | None]) -> float | None:
    available = [value for value in values if value is not None]
    if not available:
        return None
    return sum(available) / len(available)


def _technical_label(candidate: Any, opportunity: Opportunity | None) -> SignalLabel:
    readiness = _safe_float(_get_value(opportunity, "technical_readiness"))
    if readiness is not None:
        if readiness >= 0.67:
            return "strong"
        if readiness >= 0.4:
            return "neutral"
        return "weak"

    confidence = _normalize_percent(_get_value(candidate, "confidence"))
    rr = _safe_float(_get_value(candidate, "rr"))
    signal = str(_get_value(candidate, "signal", "") or "").strip()
    recommendation = _get_value(candidate, "recommendation")
    recommended = str(_get_value(recommendation, "verdict", "")).strip().upper() == "RECOMMENDED"

    supportive_signals = 0
    for metric_name in ("momentum_6m", "momentum_12m", "rel_strength"):
        metric_value = _safe_float(_get_value(candidate, metric_name))
        if metric_value is not None and metric_value > 0:
            supportive_signals += 1
    if signal:
        supportive_signals += 1

    if recommended and confidence is not None and confidence >= 70 and rr is not None and rr >= 2:
        return "strong"
    if supportive_signals >= 3 and confidence is not None and confidence >= 65:
        return "strong"
    if recommended or supportive_signals >= 2:
        return "neutral"
    if rr is not None and rr >= 1.5:
        return "neutral"
    if confidence is not None and confidence >= 55:
        return "neutral"
    return "weak"


def _fundamentals_label(snapshot: FundamentalSnapshot | None) -> SignalLabel:
    scores: list[float | None] = []
    for key in ("growth", "profitability", "balance_sheet", "cash_flow"):
        pillar = _pillar(snapshot, key)
        if pillar is None:
            continue
        scores.append(pillar.score if pillar.score is not None else _score_from_status(pillar.status))

    average = _average(scores)
    if average is None:
        return "neutral"
    if average >= 0.67:
        return "strong"
    if average >= 0.4:
        return "neutral"
    return "weak"


def _valuation_label(snapshot: FundamentalSnapshot | None) -> ValuationLabel:
    status = str(_get_value(_pillar(snapshot, "valuation"), "status", "")).strip().lower()
    if status == "strong":
        return "cheap"
    if status == "neutral":
        return "fair"
    if status == "weak":
        return "expensive"
    return "unknown"


def _catalyst_label(opportunity: Opportunity | None) -> CatalystLabel:
    if opportunity is None:
        return "weak"
    state = str(_get_value(opportunity, "state", "")).strip().upper()
    strength = _safe_float(_get_value(opportunity, "catalyst_strength"))
    if state in {"CATALYST_ACTIVE", "TRENDING"} or (strength is not None and strength >= 0.67):
        return "active"
    if state in {"WATCH", "COOLING_OFF"} or (strength is not None and strength >= 0.4):
        return "neutral"
    return "weak"


def _conviction(
    *,
    technical_label: SignalLabel,
    fundamentals_label: SignalLabel,
    valuation_label: ValuationLabel,
    catalyst_label: CatalystLabel,
    opportunity: Opportunity | None,
    snapshot: FundamentalSnapshot | None,
    same_symbol_mode: str | None,
) -> DecisionConviction:
    if same_symbol_mode == "MANAGE_ONLY":
        return "low"

    score = 0.0
    score += {"strong": 2.0, "neutral": 1.0, "weak": 0.0}[technical_label]
    score += {"strong": 2.0, "neutral": 1.0, "weak": 0.0}[fundamentals_label]
    score += {"active": 1.0, "neutral": 0.5, "weak": 0.0}[catalyst_label]
    score += {"cheap": 0.5, "fair": 0.25, "expensive": -0.5, "unknown": 0.0}[valuation_label]

    if snapshot is None:
        score -= 0.5
    else:
        coverage = str(snapshot.coverage_status or "").strip().lower()
        freshness = str(snapshot.freshness_status or "").strip().lower()
        quality = str(snapshot.data_quality_status or "").strip().lower()
        if coverage == "partial":
            score -= 0.5
        elif coverage in {"insufficient", "unsupported"}:
            score -= 1.0
        if freshness == "stale":
            score -= 1.0
        if quality == "low":
            score -= 0.5

    if opportunity is None:
        score -= 0.25
    elif str(opportunity.evidence_quality_flag or "").strip().lower() == "low":
        score -= 0.25

    if score >= 4.0:
        return "high"
    if score >= 2.0:
        return "medium"
    return "low"


def _action(
    *,
    technical_label: SignalLabel,
    fundamentals_label: SignalLabel,
    valuation_label: ValuationLabel,
    catalyst_label: CatalystLabel,
    same_symbol_mode: str | None,
) -> DecisionAction:
    if same_symbol_mode == "MANAGE_ONLY":
        return "MANAGE_ONLY"
    if technical_label == "strong" and fundamentals_label == "strong":
        return "BUY_ON_PULLBACK" if valuation_label == "expensive" else "BUY_NOW"
    if fundamentals_label == "strong" and technical_label != "strong":
        return "WAIT_FOR_BREAKOUT" if technical_label == "neutral" and catalyst_label == "active" else "WATCH"
    if technical_label == "strong" and fundamentals_label == "weak":
        return "TACTICAL_ONLY"
    if technical_label == "strong" and fundamentals_label == "neutral":
        return "WAIT_FOR_BREAKOUT" if catalyst_label == "active" or valuation_label == "expensive" else "WATCH"
    if technical_label == "weak" and fundamentals_label == "weak":
        return "AVOID"
    if technical_label == "weak":
        return "WATCH" if catalyst_label != "weak" or fundamentals_label == "neutral" else "AVOID"
    return "WATCH"


def _drivers(
    *,
    candidate: Any,
    opportunity: Opportunity | None,
    snapshot: FundamentalSnapshot | None,
    technical_label: SignalLabel,
    fundamentals_label: SignalLabel,
    valuation_label: ValuationLabel,
    catalyst_label: CatalystLabel,
    same_symbol_mode: str | None,
) -> DecisionDrivers:
    positives: list[str] = []
    negatives: list[str] = []
    warnings: list[str] = []

    if technical_label == "strong":
        _append_unique(positives, "Technical setup is ready.")
    elif technical_label == "neutral":
        _append_unique(positives, "Technical structure is constructive.")
    else:
        _append_unique(negatives, "Timing is not ready yet.")

    if fundamentals_label == "strong":
        _append_unique(positives, "Business-quality pillars are supportive.")
    elif fundamentals_label == "weak":
        _append_unique(negatives, "Business-quality pillars are weak.")

    if valuation_label == "cheap":
        _append_unique(positives, "Valuation looks reasonable versus current fundamentals.")
    elif valuation_label == "expensive":
        _append_unique(negatives, "Valuation looks demanding.")

    if catalyst_label == "active":
        _append_unique(positives, "Recent catalyst flow keeps the symbol relevant now.")
    elif catalyst_label == "weak" and opportunity is None:
        _append_unique(warnings, "No cached catalyst snapshot is available yet.")

    if snapshot is None:
        _append_unique(warnings, "No cached fundamentals snapshot is available yet.")
    else:
        if str(snapshot.coverage_status or "").strip().lower() in {"partial", "insufficient", "unsupported"}:
            _append_unique(warnings, "Fundamental coverage is partial.")
        if str(snapshot.freshness_status or "").strip().lower() == "stale":
            _append_unique(warnings, "Fundamental snapshot is stale.")
        if str(snapshot.data_quality_status or "").strip().lower() == "low":
            _append_unique(warnings, "Fundamental data quality is limited.")

    rr = _safe_float(_get_value(candidate, "rr"))
    if rr is None:
        _append_unique(warnings, "Reward-to-risk is not available yet.")
    elif rr >= 2:
        _append_unique(positives, "Trade plan has acceptable reward-to-risk.")
    elif rr < 1.5:
        _append_unique(negatives, "Reward-to-risk is light for a swing setup.")

    if same_symbol_mode == "MANAGE_ONLY":
        _append_unique(warnings, "This symbol is already in an active manage-only state.")

    return DecisionDrivers(
        positives=positives[:2],
        negatives=negatives[:2],
        warnings=warnings[:2],
    )


def _main_risk(
    *,
    snapshot: FundamentalSnapshot | None,
    opportunity: Opportunity | None,
    technical_label: SignalLabel,
    fundamentals_label: SignalLabel,
    valuation_label: ValuationLabel,
    same_symbol_mode: str | None,
) -> str:
    if same_symbol_mode == "MANAGE_ONLY":
        return "A same-symbol position or order is already live, so new entry logic can create unnecessary overlap."
    if valuation_label == "expensive":
        return "Valuation looks stretched relative to the current fundamental profile."
    if fundamentals_label == "weak":
        return "Business-quality pillars are weak, which reduces conviction if the trade stalls."
    if technical_label == "weak":
        return "Timing is not ready, so entry quality can deteriorate quickly."
    if snapshot is None:
        return "Fundamental coverage is missing, which lowers confidence in the quality read."
    if str(snapshot.freshness_status or "").strip().lower() == "stale":
        return "The fundamental snapshot is stale, so the quality read may lag the current business picture."
    if opportunity is None:
        return "Catalyst context is limited, so the why-now case is weaker."
    return "The trade still needs disciplined risk management because no single input guarantees follow-through."


def build_decision_summary(
    candidate: Any,
    opportunity: Opportunity | None = None,
    fundamentals: FundamentalSnapshot | None = None,
) -> DecisionSummary:
    symbol = str(_get_value(candidate, "ticker", "") or _get_value(candidate, "symbol", "")).strip().upper()
    same_symbol = _get_value(candidate, "same_symbol")
    same_symbol_mode = str(_get_value(same_symbol, "mode", "") or "").strip().upper() or None

    technical_label = _technical_label(candidate, opportunity)
    fundamentals_label = _fundamentals_label(fundamentals)
    valuation_label = _valuation_label(fundamentals)
    catalyst_label = _catalyst_label(opportunity)
    action = _action(
        technical_label=technical_label,
        fundamentals_label=fundamentals_label,
        valuation_label=valuation_label,
        catalyst_label=catalyst_label,
        same_symbol_mode=same_symbol_mode,
    )
    conviction = _conviction(
        technical_label=technical_label,
        fundamentals_label=fundamentals_label,
        valuation_label=valuation_label,
        catalyst_label=catalyst_label,
        opportunity=opportunity,
        snapshot=fundamentals,
        same_symbol_mode=same_symbol_mode,
    )
    drivers = _drivers(
        candidate=candidate,
        opportunity=opportunity,
        snapshot=fundamentals,
        technical_label=technical_label,
        fundamentals_label=fundamentals_label,
        valuation_label=valuation_label,
        catalyst_label=catalyst_label,
        same_symbol_mode=same_symbol_mode,
    )

    why_now = _ACTION_WHY_NOW[action]
    if action in {"WATCH", "WAIT_FOR_BREAKOUT"} and catalyst_label == "active":
        why_now = "Catalyst support is active, but cleaner confirmation is still needed before acting."

    return DecisionSummary(
        symbol=symbol,
        action=action,
        conviction=conviction,
        technical_label=technical_label,
        fundamentals_label=fundamentals_label,
        valuation_label=valuation_label,
        catalyst_label=catalyst_label,
        why_now=why_now,
        what_to_do=_ACTION_WHAT_TO_DO[action],
        main_risk=_main_risk(
            snapshot=fundamentals,
            opportunity=opportunity,
            technical_label=technical_label,
            fundamentals_label=fundamentals_label,
            valuation_label=valuation_label,
            same_symbol_mode=same_symbol_mode,
        ),
        trade_plan=DecisionTradePlan(
            entry=_safe_float(_get_value(candidate, "entry")),
            stop=_safe_float(_get_value(candidate, "stop")),
            target=_safe_float(_get_value(candidate, "target")),
            rr=_safe_float(_get_value(candidate, "rr")),
        ),
        valuation_context=DecisionValuationContext(method="fundamental_pillar"),
        drivers=DecisionDrivers(
            positives=drivers.positives,
            negatives=drivers.negatives,
            warnings=drivers.warnings,
        ),
    )
