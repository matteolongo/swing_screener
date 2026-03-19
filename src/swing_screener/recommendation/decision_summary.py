from __future__ import annotations

from typing import Any

from swing_screener.fundamentals.models import FundamentalPillarScore, FundamentalSnapshot
from swing_screener.intelligence.models import Opportunity
from swing_screener.recommendation.models import (
    CatalystLabel,
    DecisionAction,
    DecisionConviction,
    DecisionDrivers,
    FairValueMethod,
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

_VALUATION_LEAD: dict[ValuationLabel, str] = {
    "cheap": "Valuation looks reasonable on current fundamentals.",
    "fair": "Valuation looks fair on current fundamentals.",
    "expensive": "Valuation looks demanding on current fundamentals.",
    "unknown": "Valuation context is limited because current multiples are incomplete.",
}

_FAIR_VALUE_METHOD_LABELS: dict[FairValueMethod, str] = {
    "earnings_multiple": "earnings multiple",
    "sales_multiple": "sales multiple",
    "book_multiple": "book multiple",
    "not_available": "not available",
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


def _join_detail_parts(parts: list[str]) -> str | None:
    if not parts:
        return None
    if len(parts) == 1:
        return f"{parts[0]}."
    if len(parts) == 2:
        return f"{parts[0]} and {parts[1]}."
    return f"{', '.join(parts[:-1])}, and {parts[-1]}."


def _format_multiple(value: float | None) -> str | None:
    if value is None:
        return None
    return f"{value:.1f}x"


def _format_price(value: float | None) -> str | None:
    if value is None:
        return None
    return f"{value:.2f}"


def _format_percent(value: float | None) -> str | None:
    if value is None:
        return None
    sign = "+" if value >= 0 else "-"
    return f"{sign}{abs(value):.1f}%"


def _format_abs_percent(value: float | None) -> str | None:
    if value is None:
        return None
    return f"{abs(value):.1f}%"


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


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


def _pillar_score(snapshot: FundamentalSnapshot | None, key: str) -> float | None:
    pillar = _pillar(snapshot, key)
    if pillar is None:
        return None
    return pillar.score if pillar.score is not None else _score_from_status(pillar.status)


def _fair_value_range_from_earnings(
    *,
    current_price: float,
    trailing_pe: float,
    quality_score: float,
    growth_score: float,
) -> tuple[float, float, float] | None:
    if current_price <= 0 or trailing_pe <= 0:
        return None
    eps = current_price / trailing_pe
    if eps <= 0:
        return None

    base_multiple = _clamp(12.0 + (quality_score * 12.0) + (growth_score * 4.0), 10.0, 32.0)
    low_multiple = _clamp(base_multiple - 3.0, 8.0, base_multiple)
    high_multiple = _clamp(base_multiple + 3.0, base_multiple, 36.0)
    return (
        round(eps * low_multiple, 2),
        round(eps * base_multiple, 2),
        round(eps * high_multiple, 2),
    )


def _fair_value_range_from_sales(
    *,
    current_price: float,
    price_to_sales: float,
    quality_score: float,
    growth_score: float,
) -> tuple[float, float, float] | None:
    if current_price <= 0 or price_to_sales <= 0:
        return None
    revenue_per_share = current_price / price_to_sales
    if revenue_per_share <= 0:
        return None

    base_multiple = _clamp(1.5 + (quality_score * 3.0) + (growth_score * 1.5), 1.0, 8.0)
    low_multiple = _clamp(base_multiple * 0.85, 0.8, base_multiple)
    high_multiple = _clamp(base_multiple * 1.15, base_multiple, 10.0)
    return (
        round(revenue_per_share * low_multiple, 2),
        round(revenue_per_share * base_multiple, 2),
        round(revenue_per_share * high_multiple, 2),
    )


def _fair_value_range_from_book(
    *,
    book_value_per_share: float,
    quality_score: float,
    profitability_score: float,
    balance_score: float,
) -> tuple[float, float, float] | None:
    if book_value_per_share <= 0:
        return None

    base_multiple = _clamp(
        0.9 + (quality_score * 0.75) + (profitability_score * 1.25) + (balance_score * 0.85),
        0.8,
        4.5,
    )
    low_multiple = _clamp(base_multiple - 0.35, 0.6, base_multiple)
    high_multiple = _clamp(base_multiple + 0.35, base_multiple, 5.0)
    return (
        round(book_value_per_share * low_multiple, 2),
        round(book_value_per_share * base_multiple, 2),
        round(book_value_per_share * high_multiple, 2),
    )


def _fair_value_estimate(
    *,
    candidate: Any,
    snapshot: FundamentalSnapshot | None,
    trailing_pe: float | None,
    price_to_sales: float | None,
    book_value_per_share: float | None,
    price_to_book: float | None,
) -> tuple[FairValueMethod, float | None, float | None, float | None, float | None]:
    current_price = _safe_float(_get_value(candidate, "close"))
    if current_price is None or current_price <= 0 or snapshot is None:
        return "not_available", None, None, None, None

    quality_score = _average(
        [
            _pillar_score(snapshot, "growth"),
            _pillar_score(snapshot, "profitability"),
            _pillar_score(snapshot, "balance_sheet"),
            _pillar_score(snapshot, "cash_flow"),
        ]
    )
    growth_score = _pillar_score(snapshot, "growth")
    profitability_score = _pillar_score(snapshot, "profitability")
    balance_score = _pillar_score(snapshot, "balance_sheet")
    if quality_score is None:
        return "not_available", None, None, None, None

    quality = quality_score
    growth = growth_score if growth_score is not None else quality_score
    profitability = profitability_score if profitability_score is not None else quality_score
    balance = balance_score if balance_score is not None else quality_score

    low = base = high = None
    method: FairValueMethod = "not_available"
    if trailing_pe is not None and 0 < trailing_pe <= 80:
        estimate = _fair_value_range_from_earnings(
            current_price=current_price,
            trailing_pe=trailing_pe,
            quality_score=quality,
            growth_score=growth,
        )
        if estimate is not None:
            low, base, high = estimate
            method = "earnings_multiple"
    elif price_to_sales is not None and 0 < price_to_sales <= 20:
        estimate = _fair_value_range_from_sales(
            current_price=current_price,
            price_to_sales=price_to_sales,
            quality_score=quality,
            growth_score=growth,
        )
        if estimate is not None:
            low, base, high = estimate
            method = "sales_multiple"
    else:
        effective_book_value_per_share = book_value_per_share
        if effective_book_value_per_share is None and price_to_book is not None and 0 < price_to_book <= 10:
            effective_book_value_per_share = current_price / price_to_book
        if effective_book_value_per_share is not None and effective_book_value_per_share > 0:
            estimate = _fair_value_range_from_book(
                book_value_per_share=effective_book_value_per_share,
                quality_score=quality,
                profitability_score=profitability,
                balance_score=balance,
            )
            if estimate is not None:
                low, base, high = estimate
                method = "book_multiple"

    if base is None or base <= 0:
        return "not_available", None, None, None, None

    premium_discount_pct = round(((current_price - base) / base) * 100, 1)
    return method, low, base, high, premium_discount_pct


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


def _valuation_context(
    candidate: Any,
    snapshot: FundamentalSnapshot | None,
    valuation_label: ValuationLabel,
) -> DecisionValuationContext:
    trailing_pe = _safe_float(_get_value(snapshot, "trailing_pe"))
    price_to_sales = _safe_float(_get_value(snapshot, "price_to_sales"))
    book_value_per_share = _safe_float(_get_value(snapshot, "book_value_per_share"))
    price_to_book = _safe_float(_get_value(snapshot, "price_to_book"))
    book_to_price = _safe_float(_get_value(snapshot, "book_to_price"))
    method, fair_value_low, fair_value_base, fair_value_high, premium_discount_pct = _fair_value_estimate(
        candidate=candidate,
        snapshot=snapshot,
        trailing_pe=trailing_pe,
        price_to_sales=price_to_sales,
        book_value_per_share=book_value_per_share,
        price_to_book=price_to_book,
    )

    detail_parts: list[str] = []
    if trailing_pe is not None:
        detail_parts.append(f"Trailing PE is {_format_multiple(trailing_pe)}")
    if price_to_sales is not None:
        detail_parts.append(f"price-to-sales is {_format_multiple(price_to_sales)}")
    if book_value_per_share is not None:
        detail_parts.append(f"book value per share is {_format_price(book_value_per_share)}")
    if price_to_book is not None:
        detail_parts.append(f"price-to-book is {_format_multiple(price_to_book)}")
    if book_to_price is not None:
        detail_parts.append(f"book-to-price is {_format_abs_percent(book_to_price * 100)}")

    summary = _VALUATION_LEAD[valuation_label]
    if fair_value_base is not None and fair_value_low is not None and fair_value_high is not None:
        premium_text = _format_abs_percent(premium_discount_pct)
        comparison = "above" if (premium_discount_pct or 0) > 0 else "below" if (premium_discount_pct or 0) < 0 else "in line with"
        summary = (
            f"{summary} Fair value range is {_format_price(fair_value_low)} to {_format_price(fair_value_high)} "
            f"using {_FAIR_VALUE_METHOD_LABELS[method]}, and the current price is "
            f"{premium_text} {comparison} the base fair value."
        )

    detail_summary = _join_detail_parts(detail_parts)
    if detail_summary:
        summary = f"{summary} {detail_summary}"
    elif snapshot is None:
        summary = "Valuation context is limited because no cached fundamentals snapshot is available yet."

    return DecisionValuationContext(
        method=method,
        summary=summary,
        trailing_pe=trailing_pe,
        price_to_sales=price_to_sales,
        book_value_per_share=book_value_per_share,
        price_to_book=price_to_book,
        book_to_price=book_to_price,
        fair_value_low=fair_value_low,
        fair_value_base=fair_value_base,
        fair_value_high=fair_value_high,
        premium_discount_pct=premium_discount_pct,
    )


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
    valuation_context = _valuation_context(candidate, fundamentals, valuation_label)
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
        valuation_context=valuation_context,
        drivers=DecisionDrivers(
            positives=drivers.positives,
            negatives=drivers.negatives,
            warnings=drivers.warnings,
        ),
    )
