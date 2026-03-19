from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone

from swing_screener.fundamentals.config import FundamentalsConfig
from swing_screener.fundamentals.models import (
    FundamentalMetricSeries,
    FundamentalPillarScore,
    FundamentalSeriesPoint,
    FundamentalSnapshot,
    ProviderFundamentalsRecord,
)


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
        age_days = (datetime.now(timezone.utc).date() - datetime.fromisoformat(most_recent_quarter).date()).days
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


def _latest_period_end(series_map: dict[str, FundamentalMetricSeries]) -> str | None:
    latest: str | None = None
    for series in series_map.values():
        points = _sorted_points(series)
        if not points:
            continue
        candidate = points[-1].period_end
        if latest is None or candidate > latest:
            latest = candidate
    return latest


def _year_ago_point(series: FundamentalMetricSeries) -> FundamentalSeriesPoint | None:
    points = _sorted_points(series)
    if len(points) < 2:
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
            direction = "unknown"
        decorated[key] = replace(series, points=_sorted_points(series), direction=direction)
    return decorated


def _resolved_record(record: ProviderFundamentalsRecord) -> ProviderFundamentalsRecord:
    series_map = record.historical_series
    updates: dict[str, float | str | None] = {}

    if record.operating_margin is None:
        updates["operating_margin"] = _latest_series_value(series_map, "operating_margin")
    if record.free_cash_flow is None:
        updates["free_cash_flow"] = _latest_series_value(series_map, "free_cash_flow")
    if record.free_cash_flow_margin is None:
        updates["free_cash_flow_margin"] = _latest_series_value(series_map, "free_cash_flow_margin")
    if record.revenue_growth_yoy is None:
        updates["revenue_growth_yoy"] = _growth_from_series(series_map, "revenue")
    if record.most_recent_quarter is None:
        updates["most_recent_quarter"] = _latest_period_end(series_map)

    if not updates:
        return record
    return replace(record, **updates)


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

    if historical_series.get("revenue") and historical_series["revenue"].direction == "deteriorating":
        flags.append("Revenue trend has weakened versus prior periods.")
    if (
        historical_series.get("operating_margin")
        and historical_series["operating_margin"].direction == "deteriorating"
    ):
        flags.append("Operating margin is deteriorating.")
    if (
        historical_series.get("free_cash_flow_margin")
        and historical_series["free_cash_flow_margin"].direction == "deteriorating"
    ):
        flags.append("Cash-flow conversion is deteriorating.")

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

    if historical_series.get("revenue") and historical_series["revenue"].direction == "improving":
        highlights.append("Recent revenue trend is improving.")
    if (
        historical_series.get("operating_margin")
        and historical_series["operating_margin"].direction == "improving"
    ):
        highlights.append("Margins are improving across recent periods.")
    if pillars["growth"].status == "strong":
        highlights.append("Growth metrics are supportive.")
    if pillars["profitability"].status == "strong":
        highlights.append("Profitability profile looks healthy.")
    if pillars["balance_sheet"].status == "weak":
        highlights.append("Balance sheet quality needs caution.")
    if pillars["valuation"].status == "weak":
        highlights.append("Valuation looks demanding versus simple heuristics.")
    if any(".quarterly_" in source or source.endswith(".financials") or source.endswith(".cashflow") for source in record.metric_sources.values()):
        highlights.append("Snapshot was supplemented with statement history.")
    if not highlights:
        highlights.append("No strong fundamental edge is visible yet.")
    return highlights[:4]


def build_snapshot(record: ProviderFundamentalsRecord, cfg: FundamentalsConfig) -> FundamentalSnapshot:
    resolved_record = _resolved_record(record)
    supported = _is_supported_equity(resolved_record.instrument_type)
    coverage_status = _coverage_status(resolved_record, supported)
    freshness_status = _freshness_status(resolved_record.most_recent_quarter, cfg.stale_after_days)
    historical_series = _decorate_historical_series(resolved_record.historical_series)
    pillars = _build_pillars(resolved_record)
    red_flags = _build_red_flags(resolved_record, freshness_status, historical_series)
    highlights = _build_highlights(resolved_record, pillars, coverage_status, historical_series)

    return FundamentalSnapshot(
        symbol=resolved_record.symbol,
        asof_date=resolved_record.asof_date,
        provider=resolved_record.provider,
        updated_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
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
        most_recent_quarter=resolved_record.most_recent_quarter,
        pillars=pillars,
        historical_series=historical_series,
        red_flags=red_flags,
        highlights=highlights,
        metric_sources=resolved_record.metric_sources,
        error=resolved_record.provider_error,
    )


def build_provider_error_snapshot(symbol: str, provider: str, error: str) -> FundamentalSnapshot:
    return FundamentalSnapshot(
        symbol=symbol,
        asof_date=datetime.now(timezone.utc).date().isoformat(),
        provider=provider,
        updated_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        supported=True,
        coverage_status="insufficient",
        freshness_status="unknown",
        pillars={},
        historical_series={},
        red_flags=[error],
        highlights=["Provider call failed; no fresh fundamental snapshot is available."],
        error=error,
    )
