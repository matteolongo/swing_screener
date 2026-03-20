from __future__ import annotations

from dataclasses import replace
from datetime import datetime

from swing_screener.fundamentals.config import FundamentalsConfig
from swing_screener.fundamentals.models import (
    FundamentalMetricContext,
    FundamentalMetricSeries,
    FundamentalPillarScore,
    FundamentalSeriesPoint,
    FundamentalSnapshot,
    ProviderFundamentalsRecord,
)

_METRIC_SERIES_MAP = {
    "revenue_growth_yoy": "revenue",
    "operating_margin": "operating_margin",
    "free_cash_flow": "free_cash_flow",
    "free_cash_flow_margin": "free_cash_flow_margin",
}
_METRIC_LABELS = {
    "revenue_growth_yoy": "Revenue YoY",
    "earnings_growth_yoy": "Earnings YoY",
    "gross_margin": "Gross margin",
    "operating_margin": "Operating margin",
    "free_cash_flow": "Free cash flow",
    "free_cash_flow_margin": "FCF margin",
    "debt_to_equity": "Debt / equity",
    "current_ratio": "Current ratio",
    "return_on_equity": "Return on equity",
    "trailing_pe": "Trailing PE",
    "price_to_sales": "Price / sales",
    "shares_outstanding": "Shares outstanding",
    "total_equity": "Total equity",
    "book_value_per_share": "Book value / share",
    "price_to_book": "Price / book",
    "book_to_price": "Book / price",
}


def _merge_source_names(*names: str | None) -> str | None:
    unique: list[str] = []
    for name in names:
        text = str(name or "").strip()
        if not text or text in unique:
            continue
        unique.append(text)
    if not unique:
        return None
    return " + ".join(unique)


def _score_higher(value: float | None, *, weak: float, strong: float) -> float | None:
    if value is None:
        return None
    if value <= weak:
        return 0.0
    if value >= strong:
        return 1.0
    return round((value - weak) / (strong - weak), 4)


def _score_lower(value: float | None, *, strong: float, weak: float) -> float | None:
    if value is None:
        return None
    if value <= strong:
        return 1.0
    if value >= weak:
        return 0.0
    return round((weak - value) / (weak - strong), 4)


def _blend_scores(*values: float | None) -> float | None:
    available = [float(value) for value in values if value is not None]
    if not available:
        return None
    return round(sum(available) / len(available), 4)


def _status_for_score(score: float | None) -> str:
    if score is None:
        return "unavailable"
    if score >= 0.67:
        return "strong"
    if score >= 0.4:
        return "neutral"
    return "weak"


def _freshness_status(most_recent_quarter: str | None, stale_after_days: int) -> str:
    if not most_recent_quarter:
        return "unknown"
    try:
        age_days = (datetime.utcnow().date() - datetime.fromisoformat(most_recent_quarter).date()).days
    except ValueError:
        return "unknown"
    return "stale" if age_days > stale_after_days else "current"


def _coverage_status(record: ProviderFundamentalsRecord, supported: bool) -> str:
    if not supported:
        return "unsupported"
    available = [
        record.revenue_growth_yoy,
        record.earnings_growth_yoy,
        record.gross_margin,
        record.operating_margin,
        record.free_cash_flow_margin,
        record.debt_to_equity,
        record.current_ratio,
        record.return_on_equity,
        record.trailing_pe,
        record.price_to_sales,
        record.book_value_per_share,
        record.price_to_book,
    ]
    count = sum(1 for value in available if value is not None)
    if count >= 7:
        return "supported"
    if count >= 4:
        return "partial"
    return "insufficient"


def _is_supported_equity(instrument_type: str) -> bool:
    normalized = str(instrument_type or "").strip().lower()
    return normalized in {"equity", "stock", "common stock"}


def _sorted_points(series: FundamentalMetricSeries) -> list[FundamentalSeriesPoint]:
    return sorted(
        [point for point in series.points if point.period_end],
        key=lambda point: point.period_end,
    )


def _latest_series_value(series_map: dict[str, FundamentalMetricSeries], key: str) -> float | None:
    series = series_map.get(key)
    if not series:
        return None
    points = _sorted_points(series)
    if not points:
        return None
    return float(points[-1].value)


def _latest_series_period(series_map: dict[str, FundamentalMetricSeries], key: str) -> str | None:
    series = series_map.get(key)
    if not series:
        return None
    points = _sorted_points(series)
    if not points:
        return None
    return points[-1].period_end


def _latest_period_end(series_map: dict[str, FundamentalMetricSeries], *, frequency: str | None = None) -> str | None:
    latest: str | None = None
    for series in series_map.values():
        if frequency is not None and series.frequency != frequency:
            continue
        points = _sorted_points(series)
        if not points:
            continue
        candidate = points[-1].period_end
        if latest is None or candidate > latest:
            latest = candidate
    return latest


def _year_ago_point(series: FundamentalMetricSeries) -> FundamentalSeriesPoint | None:
    points = _sorted_points(series)
    if len(points) < 2 or series.frequency not in {"quarterly", "annual"}:
        return None
    latest = points[-1]
    try:
        latest_date = datetime.fromisoformat(latest.period_end).date()
    except ValueError:
        return None
    candidates: list[tuple[int, FundamentalSeriesPoint]] = []
    for point in points[:-1]:
        try:
            point_date = datetime.fromisoformat(point.period_end).date()
        except ValueError:
            continue
        delta_days = (latest_date - point_date).days
        if 280 <= delta_days <= 460:
            candidates.append((abs(delta_days - 365), point))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0])
    return candidates[0][1]


def _growth_from_series(series_map: dict[str, FundamentalMetricSeries], key: str) -> float | None:
    series = series_map.get(key)
    if not series:
        return None
    points = _sorted_points(series)
    if len(points) < 2:
        return None
    latest = points[-1]
    prior = _year_ago_point(series)
    if prior is None or prior.value == 0:
        return None
    return round((latest.value / prior.value) - 1.0, 4)


def _cadence_from_source_name(source: str | None) -> str:
    text = str(source or "").strip().lower()
    if not text:
        return "unknown"
    if ".quarterly_" in text:
        return "quarterly"
    if text.endswith(".financials") or text.endswith(".cashflow") or text.endswith(".income_stmt") or text.endswith(".balance_sheet"):
        return "annual"
    if ".info." in text:
        return "snapshot"
    return "unknown"


def _context_from_series(series: FundamentalMetricSeries | None) -> FundamentalMetricContext | None:
    if series is None:
        return None
    source = series.source
    derived_from = list(series.derived_from)
    return FundamentalMetricContext(
        source=source,
        cadence=series.frequency,
        derived=bool(derived_from and not (len(derived_from) == 1 and derived_from[0] == source)),
        derived_from=derived_from,
        period_end=(_sorted_points(series)[-1].period_end if _sorted_points(series) else None),
    )


def _ensure_direct_metric_context(
    metric_context: dict[str, FundamentalMetricContext],
    metric_sources: dict[str, str],
    series_map: dict[str, FundamentalMetricSeries],
    metric_name: str,
) -> None:
    if metric_name in metric_context:
        return
    source = metric_sources.get(metric_name)
    if not source:
        return
    series_key = _METRIC_SERIES_MAP.get(metric_name)
    period_end = _latest_series_period(series_map, series_key) if series_key else None
    metric_context[metric_name] = FundamentalMetricContext(
        source=source,
        cadence=_cadence_from_source_name(source),
        derived=False,
        derived_from=[],
        period_end=period_end,
    )


def _derived_metric_context(
    metric_context: dict[str, FundamentalMetricContext],
    metric_sources: dict[str, str],
    metric_names: list[str],
) -> FundamentalMetricContext:
    contexts = [metric_context.get(metric_name) for metric_name in metric_names]
    cadences = {context.cadence for context in contexts if context is not None and context.cadence != "unknown"}
    cadence = next(iter(cadences)) if len(cadences) == 1 else "unknown"

    derived_from: list[str] = []
    for metric_name in metric_names:
        source = metric_sources.get(metric_name)
        if source and source not in derived_from:
            derived_from.append(source)
            continue
        context = metric_context.get(metric_name)
        if context is not None and context.source and context.source not in derived_from:
            derived_from.append(context.source)

    period_end = None
    for context in contexts:
        if context is None or not context.period_end:
            continue
        if period_end is None or context.period_end > period_end:
            period_end = context.period_end

    source = _merge_source_names(*derived_from)
    return FundamentalMetricContext(
        source=source,
        cadence=cadence,
        derived=True,
        derived_from=derived_from,
        period_end=period_end,
    )


def _series_direction(
    series: FundamentalMetricSeries,
    *,
    favorable_when: str,
    relative_threshold: float | None = None,
    absolute_threshold: float | None = None,
) -> str:
    points = _sorted_points(series)
    if len(points) < 2:
        return "unknown"
    if series.frequency not in {"quarterly", "annual"}:
        return "not_comparable"
    previous = float(points[-2].value)
    latest = float(points[-1].value)
    delta = latest - previous

    if absolute_threshold is not None and abs(delta) <= absolute_threshold:
        return "stable"

    if relative_threshold is not None:
        denominator = max(abs(previous), 1e-9)
        if abs(delta) / denominator <= relative_threshold:
            return "stable"

    if latest > previous:
        return "improving" if favorable_when == "higher" else "deteriorating"
    if latest < previous:
        return "deteriorating" if favorable_when == "higher" else "improving"
    return "stable"


def _decorate_historical_series(
    series_map: dict[str, FundamentalMetricSeries],
) -> dict[str, FundamentalMetricSeries]:
    decorated: dict[str, FundamentalMetricSeries] = {}
    for key, series in series_map.items():
        if key == "revenue":
            direction = _series_direction(series, favorable_when="higher", relative_threshold=0.03)
        elif key in {"operating_margin", "free_cash_flow_margin"}:
            direction = _series_direction(series, favorable_when="higher", absolute_threshold=0.015)
        elif key == "free_cash_flow":
            direction = _series_direction(series, favorable_when="higher", relative_threshold=0.05)
        else:
            direction = "unknown" if len(_sorted_points(series)) < 2 else "not_comparable"
        decorated[key] = replace(
            series,
            points=_sorted_points(series),
            direction=direction,
        )
    return decorated


def _resolved_record(record: ProviderFundamentalsRecord) -> ProviderFundamentalsRecord:
    series_map = record.historical_series
    updates: dict[str, float | str | None] = {}
    metric_context = dict(record.metric_context)
    metric_sources = dict(record.metric_sources)

    if record.operating_margin is None:
        updates["operating_margin"] = _latest_series_value(series_map, "operating_margin")
        context = _context_from_series(series_map.get("operating_margin"))
        if context is not None:
            metric_context["operating_margin"] = context
    if record.free_cash_flow is None:
        updates["free_cash_flow"] = _latest_series_value(series_map, "free_cash_flow")
        context = _context_from_series(series_map.get("free_cash_flow"))
        if context is not None:
            metric_context["free_cash_flow"] = context
    if record.free_cash_flow_margin is None:
        updates["free_cash_flow_margin"] = _latest_series_value(series_map, "free_cash_flow_margin")
        context = _context_from_series(series_map.get("free_cash_flow_margin"))
        if context is not None:
            metric_context["free_cash_flow_margin"] = context
    if record.revenue_growth_yoy is None:
        updates["revenue_growth_yoy"] = _growth_from_series(series_map, "revenue")
        context = _context_from_series(series_map.get("revenue"))
        if context is not None:
            metric_context["revenue_growth_yoy"] = replace(context, derived=True)
    if record.most_recent_quarter is None:
        updates["most_recent_quarter"] = _latest_period_end(series_map, frequency="quarterly")

    for metric_name in _METRIC_LABELS:
        _ensure_direct_metric_context(metric_context, metric_sources, series_map, metric_name)

    if (
        record.book_value_per_share is None
        and record.total_equity not in (None, 0)
        and record.shares_outstanding not in (None, 0)
    ):
        updates["book_value_per_share"] = float(record.total_equity) / float(record.shares_outstanding)
        derived_context = _derived_metric_context(
            metric_context,
            metric_sources,
            ["total_equity", "shares_outstanding"],
        )
        metric_context["book_value_per_share"] = derived_context
        if derived_context.source:
            metric_sources["book_value_per_share"] = derived_context.source

    price_to_book = record.price_to_book
    if price_to_book is None and record.market_cap not in (None, 0) and record.total_equity not in (None, 0):
        updates["price_to_book"] = float(record.market_cap) / float(record.total_equity)
        derived_context = _derived_metric_context(
            metric_context,
            metric_sources,
            ["market_cap", "total_equity"],
        )
        metric_context["price_to_book"] = derived_context
        if derived_context.source:
            metric_sources["price_to_book"] = derived_context.source
        price_to_book = updates["price_to_book"]

    effective_price_to_book = (
        float(price_to_book)
        if price_to_book not in (None, 0)
        else float(updates["price_to_book"])
        if updates.get("price_to_book") not in (None, 0)
        else None
    )
    if record.book_to_price is None and effective_price_to_book not in (None, 0):
        updates["book_to_price"] = 1.0 / effective_price_to_book
        derived_context = _derived_metric_context(metric_context, metric_sources, ["price_to_book"])
        metric_context["book_to_price"] = derived_context
        if derived_context.source:
            metric_sources["book_to_price"] = derived_context.source

    if not updates and metric_context == record.metric_context and metric_sources == record.metric_sources:
        return record
    return replace(record, metric_context=metric_context, metric_sources=metric_sources, **updates)


def _build_pillars(record: ProviderFundamentalsRecord) -> dict[str, FundamentalPillarScore]:
    growth_score = _blend_scores(
        _score_higher(record.revenue_growth_yoy, weak=-0.05, strong=0.15),
        _score_higher(record.earnings_growth_yoy, weak=-0.1, strong=0.2),
    )
    profitability_score = _blend_scores(
        _score_higher(record.gross_margin, weak=0.2, strong=0.55),
        _score_higher(record.operating_margin, weak=0.05, strong=0.22),
        _score_higher(record.return_on_equity, weak=0.05, strong=0.2),
    )
    balance_sheet_score = _blend_scores(
        _score_lower(record.debt_to_equity, strong=60.0, weak=220.0),
        _score_higher(record.current_ratio, weak=0.9, strong=1.8),
    )
    cash_flow_score = _score_higher(record.free_cash_flow_margin, weak=0.0, strong=0.15)
    valuation_score = _blend_scores(
        _score_lower(record.trailing_pe, strong=12.0, weak=35.0),
        _score_lower(record.price_to_sales, strong=2.0, weak=8.0),
        _score_lower(record.price_to_book, strong=1.2, weak=4.0),
    )

    return {
        "growth": FundamentalPillarScore(
            score=growth_score,
            status=_status_for_score(growth_score),
            summary="Revenue and earnings growth profile.",
        ),
        "profitability": FundamentalPillarScore(
            score=profitability_score,
            status=_status_for_score(profitability_score),
            summary="Margins and returns quality.",
        ),
        "balance_sheet": FundamentalPillarScore(
            score=balance_sheet_score,
            status=_status_for_score(balance_sheet_score),
            summary="Leverage and liquidity resilience.",
        ),
        "cash_flow": FundamentalPillarScore(
            score=cash_flow_score,
            status=_status_for_score(cash_flow_score),
            summary="Cash generation and FCF support.",
        ),
        "valuation": FundamentalPillarScore(
            score=valuation_score,
            status=_status_for_score(valuation_score),
            summary="Current valuation pressure.",
        ),
    }


def _trend_prefix(series: FundamentalMetricSeries) -> str:
    if series.frequency == "quarterly":
        return "Quarterly"
    if series.frequency == "annual":
        return "Annual"
    return "Visible"


def _build_red_flags(
    record: ProviderFundamentalsRecord,
    freshness_status: str,
    historical_series: dict[str, FundamentalMetricSeries],
) -> list[str]:
    flags: list[str] = []
    if record.earnings_growth_yoy is not None and record.earnings_growth_yoy < 0:
        flags.append("Earnings growth is negative.")
    if record.free_cash_flow is not None and record.free_cash_flow <= 0:
        flags.append("Free cash flow is negative.")
    if record.operating_margin is not None and record.operating_margin < 0.08:
        flags.append("Operating margin is thin.")
    if record.debt_to_equity is not None and record.debt_to_equity > 150:
        flags.append("Leverage is elevated.")
    if record.current_ratio is not None and record.current_ratio < 1.0:
        flags.append("Current ratio is below 1.0.")
    if freshness_status == "stale":
        flags.append("Latest reported quarter looks stale.")

    revenue_series = historical_series.get("revenue")
    if revenue_series and revenue_series.direction == "deteriorating":
        flags.append(f"{_trend_prefix(revenue_series)} revenue trend is deteriorating.")
    operating_margin_series = historical_series.get("operating_margin")
    if operating_margin_series and operating_margin_series.direction == "deteriorating":
        flags.append(f"{_trend_prefix(operating_margin_series)} operating margin is deteriorating.")
    fcf_margin_series = historical_series.get("free_cash_flow_margin")
    if fcf_margin_series and fcf_margin_series.direction == "deteriorating":
        flags.append(f"{_trend_prefix(fcf_margin_series)} cash-flow conversion is deteriorating.")

    if record.provider_error:
        flags.append(record.provider_error)
    return flags


def _build_highlights(
    record: ProviderFundamentalsRecord,
    pillars: dict[str, FundamentalPillarScore],
    coverage_status: str,
    historical_series: dict[str, FundamentalMetricSeries],
) -> list[str]:
    highlights: list[str] = []
    if coverage_status == "unsupported":
        highlights.append("Instrument is not a single-company equity.")
        return highlights
    if coverage_status == "insufficient":
        highlights.append("Coverage is still thin; use the snapshot as a partial research aid.")

    revenue_series = historical_series.get("revenue")
    if revenue_series and revenue_series.direction == "improving":
        highlights.append(f"{_trend_prefix(revenue_series)} revenue trend is improving.")
    operating_margin_series = historical_series.get("operating_margin")
    if operating_margin_series and operating_margin_series.direction == "improving":
        highlights.append(f"{_trend_prefix(operating_margin_series)} margins are improving.")
    if pillars["growth"].status == "strong":
        highlights.append("Growth metrics are supportive.")
    if pillars["profitability"].status == "strong":
        highlights.append("Profitability profile looks healthy.")
    if pillars["balance_sheet"].status == "weak":
        highlights.append("Balance sheet quality needs caution.")
    if pillars["valuation"].status == "weak":
        highlights.append("Valuation looks demanding versus simple heuristics.")
    if any(series.source and ".quarterly_" in series.source for series in historical_series.values()):
        highlights.append("Quarterly statement history is available for context.")
    if not highlights:
        highlights.append("No strong fundamental edge is visible yet.")
    return highlights[:4]


def _build_data_quality(
    record: ProviderFundamentalsRecord,
    historical_series: dict[str, FundamentalMetricSeries],
) -> tuple[str, list[str]]:
    flags: list[str] = []
    low_severity = False

    if record.provider_error:
        flags.append("Provider reported an error; snapshot may be incomplete.")
        low_severity = True

    for metric_name in ("revenue_growth_yoy", "earnings_growth_yoy"):
        value = getattr(record, metric_name)
        if value is not None and abs(value) > 3.0:
            flags.append(f"{_METRIC_LABELS[metric_name]} looks extreme and may reflect a base effect.")
            low_severity = True

    for metric_name, series_key in _METRIC_SERIES_MAP.items():
        context = record.metric_context.get(metric_name)
        series = historical_series.get(series_key)
        if context is None or series is None:
            continue
        if context.cadence in {"snapshot", "quarterly", "annual"} and series.frequency in {"quarterly", "annual"}:
            if context.cadence != series.frequency:
                flags.append(
                    f"{_METRIC_LABELS[metric_name]} mixes {context.cadence} metric data with {series.frequency} history."
                )
                low_severity = True

    for series_key, label in (
        ("revenue", "Revenue"),
        ("operating_margin", "Operating margin"),
        ("free_cash_flow_margin", "FCF margin"),
    ):
        series = historical_series.get(series_key)
        if series is None:
            continue
        if series.direction == "not_comparable":
            flags.append(f"{label} history is not comparable enough for trend claims.")
        elif series.direction == "unknown" and len(_sorted_points(series)) > 0:
            flags.append(f"{label} history is too sparse for a reliable trend signal.")

    for metric_name in ("operating_margin", "free_cash_flow_margin"):
        context = record.metric_context.get(metric_name)
        if context is None or not context.derived:
            continue
        series = historical_series.get(_METRIC_SERIES_MAP.get(metric_name, ""))
        if context.cadence == "unknown" or (series is not None and series.frequency == "unknown"):
            flags.append(f"{_METRIC_LABELS[metric_name]} was derived from incomplete or mismatched periods.")
            low_severity = True

    has_annual_history = any(series.frequency == "annual" for series in historical_series.values())
    has_quarterly_history = any(series.frequency == "quarterly" for series in historical_series.values())
    if has_annual_history and not has_quarterly_history:
        flags.append("Visible statement history is annual-only, so quarter-level trust is limited.")

    deduped_flags: list[str] = []
    for flag in flags:
        text = str(flag).strip()
        if not text or text in deduped_flags:
            continue
        deduped_flags.append(text)

    if not deduped_flags:
        return "high", []
    if low_severity:
        return "low", deduped_flags
    return "medium", deduped_flags


def build_snapshot(record: ProviderFundamentalsRecord, cfg: FundamentalsConfig) -> FundamentalSnapshot:
    resolved_record = _resolved_record(record)
    supported = _is_supported_equity(resolved_record.instrument_type)
    coverage_status = _coverage_status(resolved_record, supported)
    freshness_status = _freshness_status(resolved_record.most_recent_quarter, cfg.stale_after_days)
    historical_series = _decorate_historical_series(resolved_record.historical_series)
    pillars = _build_pillars(resolved_record)
    red_flags = _build_red_flags(resolved_record, freshness_status, historical_series)
    highlights = _build_highlights(resolved_record, pillars, coverage_status, historical_series)
    data_quality_status, data_quality_flags = _build_data_quality(resolved_record, historical_series)

    return FundamentalSnapshot(
        symbol=resolved_record.symbol,
        asof_date=resolved_record.asof_date,
        provider=resolved_record.provider,
        updated_at=datetime.utcnow().replace(microsecond=0).isoformat(),
        instrument_type=resolved_record.instrument_type,
        supported=supported,
        coverage_status=coverage_status,
        freshness_status=freshness_status,
        company_name=resolved_record.company_name,
        sector=resolved_record.sector,
        currency=resolved_record.currency,
        market_cap=resolved_record.market_cap,
        revenue_growth_yoy=resolved_record.revenue_growth_yoy,
        earnings_growth_yoy=resolved_record.earnings_growth_yoy,
        gross_margin=resolved_record.gross_margin,
        operating_margin=resolved_record.operating_margin,
        free_cash_flow=resolved_record.free_cash_flow,
        free_cash_flow_margin=resolved_record.free_cash_flow_margin,
        debt_to_equity=resolved_record.debt_to_equity,
        current_ratio=resolved_record.current_ratio,
        return_on_equity=resolved_record.return_on_equity,
        trailing_pe=resolved_record.trailing_pe,
        price_to_sales=resolved_record.price_to_sales,
        shares_outstanding=resolved_record.shares_outstanding,
        total_equity=resolved_record.total_equity,
        book_value_per_share=resolved_record.book_value_per_share,
        price_to_book=resolved_record.price_to_book,
        book_to_price=resolved_record.book_to_price,
        most_recent_quarter=resolved_record.most_recent_quarter,
        data_region=resolved_record.data_region,
        pillars=pillars,
        historical_series=historical_series,
        metric_context=resolved_record.metric_context,
        data_quality_status=data_quality_status,
        data_quality_flags=data_quality_flags,
        red_flags=red_flags,
        highlights=highlights,
        metric_sources=resolved_record.metric_sources,
        error=resolved_record.provider_error,
    )


def build_provider_error_snapshot(symbol: str, provider: str, error: str) -> FundamentalSnapshot:
    return FundamentalSnapshot(
        symbol=symbol,
        asof_date=datetime.utcnow().date().isoformat(),
        provider=provider,
        updated_at=datetime.utcnow().replace(microsecond=0).isoformat(),
        supported=True,
        coverage_status="insufficient",
        freshness_status="unknown",
        pillars={},
        historical_series={},
        metric_context={},
        data_quality_status="low",
        data_quality_flags=["Provider reported an error; snapshot may be incomplete."],
        red_flags=[error],
        highlights=["Provider call failed; no fresh fundamental snapshot is available."],
        error=error,
    )
