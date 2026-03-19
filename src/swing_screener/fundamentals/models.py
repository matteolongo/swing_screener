from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

VALID_METRIC_UNITS = {"number", "currency", "percent", "ratio"}
VALID_SERIES_DIRECTIONS = {"improving", "deteriorating", "stable", "unknown", "not_comparable"}
VALID_SERIES_FREQUENCIES = {"quarterly", "annual", "unknown"}
VALID_METRIC_CADENCES = {"snapshot", "quarterly", "annual", "unknown"}
VALID_DATA_QUALITY_STATUSES = {"high", "medium", "low"}


def _trend_claim_supported(
    text: str,
    historical_series: dict[str, "FundamentalMetricSeries"],
) -> bool:
    normalized = str(text).strip().lower()
    if not normalized:
        return False

    trend_rules = (
        ("revenue", "improving", ("revenue trend is improving",)),
        ("revenue", "deteriorating", ("revenue trend is deteriorating",)),
        (
            "operating_margin",
            "improving",
            ("margins are improving", "operating margin is improving"),
        ),
        ("operating_margin", "deteriorating", ("operating margin is deteriorating",)),
        (
            "free_cash_flow_margin",
            "improving",
            ("cash-flow conversion is improving",),
        ),
        (
            "free_cash_flow_margin",
            "deteriorating",
            ("cash-flow conversion is deteriorating",),
        ),
    )

    for series_key, expected_direction, patterns in trend_rules:
        if not any(pattern in normalized for pattern in patterns):
            continue
        direction = historical_series.get(series_key, FundamentalMetricSeries(label=series_key)).direction
        return direction == expected_direction
    return True


def _sanitize_trend_claims(
    items: list[Any],
    historical_series: dict[str, "FundamentalMetricSeries"],
) -> list[str]:
    sanitized: list[str] = []
    for item in items:
        text = str(item).strip()
        if not text:
            continue
        if not _trend_claim_supported(text, historical_series):
            continue
        sanitized.append(text)
    return sanitized


@dataclass(frozen=True)
class FundamentalPillarScore:
    score: float | None = None
    status: str = "unavailable"
    summary: str = ""


@dataclass(frozen=True)
class FundamentalMetricContext:
    source: str | None = None
    cadence: str = "unknown"
    derived: bool = False
    derived_from: list[str] = field(default_factory=list)
    period_end: str | None = None


@dataclass(frozen=True)
class FundamentalSeriesPoint:
    period_end: str
    value: float


@dataclass(frozen=True)
class FundamentalMetricSeries:
    label: str
    unit: str = "number"
    frequency: str = "unknown"
    direction: str = "unknown"
    source: str | None = None
    derived_from: list[str] = field(default_factory=list)
    points: list[FundamentalSeriesPoint] = field(default_factory=list)


@dataclass(frozen=True)
class ProviderFundamentalsRecord:
    symbol: str
    asof_date: str
    provider: str
    instrument_type: str = "unknown"
    company_name: str | None = None
    sector: str | None = None
    currency: str | None = None
    most_recent_quarter: str | None = None
    market_cap: float | None = None
    revenue_growth_yoy: float | None = None
    earnings_growth_yoy: float | None = None
    gross_margin: float | None = None
    operating_margin: float | None = None
    free_cash_flow: float | None = None
    free_cash_flow_margin: float | None = None
    debt_to_equity: float | None = None
    current_ratio: float | None = None
    return_on_equity: float | None = None
    trailing_pe: float | None = None
    price_to_sales: float | None = None
    historical_series: dict[str, FundamentalMetricSeries] = field(default_factory=dict)
    metric_context: dict[str, FundamentalMetricContext] = field(default_factory=dict)
    metric_sources: dict[str, str] = field(default_factory=dict)
    provider_error: str | None = None


@dataclass(frozen=True)
class FundamentalSnapshot:
    symbol: str
    asof_date: str
    provider: str
    updated_at: str
    instrument_type: str = "unknown"
    supported: bool = True
    coverage_status: str = "insufficient"
    freshness_status: str = "unknown"
    company_name: str | None = None
    sector: str | None = None
    currency: str | None = None
    market_cap: float | None = None
    revenue_growth_yoy: float | None = None
    earnings_growth_yoy: float | None = None
    gross_margin: float | None = None
    operating_margin: float | None = None
    free_cash_flow: float | None = None
    free_cash_flow_margin: float | None = None
    debt_to_equity: float | None = None
    current_ratio: float | None = None
    return_on_equity: float | None = None
    trailing_pe: float | None = None
    price_to_sales: float | None = None
    most_recent_quarter: str | None = None
    pillars: dict[str, FundamentalPillarScore] = field(default_factory=dict)
    historical_series: dict[str, FundamentalMetricSeries] = field(default_factory=dict)
    metric_context: dict[str, FundamentalMetricContext] = field(default_factory=dict)
    data_quality_status: str = "low"
    data_quality_flags: list[str] = field(default_factory=list)
    red_flags: list[str] = field(default_factory=list)
    highlights: list[str] = field(default_factory=list)
    metric_sources: dict[str, str] = field(default_factory=dict)
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "FundamentalSnapshot":
        pillars_payload = payload.get("pillars") if isinstance(payload.get("pillars"), dict) else {}
        pillars: dict[str, FundamentalPillarScore] = {}
        for key, value in pillars_payload.items():
            if isinstance(value, dict):
                pillars[str(key)] = FundamentalPillarScore(
                    score=value.get("score"),
                    status=str(value.get("status", "unavailable")),
                    summary=str(value.get("summary", "")),
                )
            else:
                pillars[str(key)] = FundamentalPillarScore(summary=str(value))

        historical_payload = (
            payload.get("historical_series") if isinstance(payload.get("historical_series"), dict) else {}
        )
        historical_series: dict[str, FundamentalMetricSeries] = {}
        for key, value in historical_payload.items():
            if not isinstance(value, dict):
                continue
            points_payload = value.get("points") if isinstance(value.get("points"), list) else []
            points: list[FundamentalSeriesPoint] = []
            for item in points_payload:
                if not isinstance(item, dict):
                    continue
                period_end = str(item.get("period_end", "")).strip()
                if not period_end:
                    continue
                try:
                    numeric_value = float(item.get("value"))
                except (TypeError, ValueError):
                    continue
                points.append(FundamentalSeriesPoint(period_end=period_end, value=numeric_value))
            raw_unit = str(value.get("unit", "number")).strip().lower()
            unit = raw_unit if raw_unit in VALID_METRIC_UNITS else "number"
            raw_frequency = str(value.get("frequency", "unknown")).strip().lower()
            frequency = raw_frequency if raw_frequency in VALID_SERIES_FREQUENCIES else "unknown"
            raw_direction = str(value.get("direction", "unknown")).strip().lower()
            direction = raw_direction if raw_direction in VALID_SERIES_DIRECTIONS else "unknown"
            historical_series[str(key)] = FundamentalMetricSeries(
                label=str(value.get("label", key)).strip() or str(key),
                unit=unit,
                frequency=frequency,
                direction=direction,
                source=(str(value.get("source")).strip() if value.get("source") else None),
                derived_from=[
                    str(item).strip()
                    for item in value.get("derived_from", [])
                    if str(item).strip()
                ],
                points=points,
            )

        metric_context_payload = (
            payload.get("metric_context") if isinstance(payload.get("metric_context"), dict) else {}
        )
        metric_context: dict[str, FundamentalMetricContext] = {}
        for key, value in metric_context_payload.items():
            if not isinstance(value, dict):
                continue
            raw_cadence = str(value.get("cadence", "unknown")).strip().lower()
            cadence = raw_cadence if raw_cadence in VALID_METRIC_CADENCES else "unknown"
            metric_context[str(key)] = FundamentalMetricContext(
                source=(str(value.get("source")).strip() if value.get("source") else None),
                cadence=cadence,
                derived=bool(value.get("derived", False)),
                derived_from=[
                    str(item).strip()
                    for item in value.get("derived_from", [])
                    if str(item).strip()
                ],
                period_end=(str(value.get("period_end")).strip() if value.get("period_end") else None),
            )

        data_quality_flags = [
            str(item) for item in payload.get("data_quality_flags", []) if str(item).strip()
        ]
        raw_quality_status = str(payload.get("data_quality_status", "")).strip().lower()
        data_quality_status = raw_quality_status if raw_quality_status in VALID_DATA_QUALITY_STATUSES else "low"
        if "data_quality_status" not in payload:
            data_quality_status = "low"
            trust_flag = "Snapshot lacks trust metadata; refresh fundamentals to validate cadence and provenance."
            if trust_flag not in data_quality_flags:
                data_quality_flags.append(trust_flag)

        return cls(
            symbol=str(payload.get("symbol", "")).strip().upper(),
            asof_date=str(payload.get("asof_date", "")),
            provider=str(payload.get("provider", "yfinance")),
            updated_at=str(payload.get("updated_at", "")),
            instrument_type=str(payload.get("instrument_type", "unknown")),
            supported=bool(payload.get("supported", True)),
            coverage_status=str(payload.get("coverage_status", "insufficient")),
            freshness_status=str(payload.get("freshness_status", "unknown")),
            company_name=payload.get("company_name"),
            sector=payload.get("sector"),
            currency=payload.get("currency"),
            market_cap=payload.get("market_cap"),
            revenue_growth_yoy=payload.get("revenue_growth_yoy"),
            earnings_growth_yoy=payload.get("earnings_growth_yoy"),
            gross_margin=payload.get("gross_margin"),
            operating_margin=payload.get("operating_margin"),
            free_cash_flow=payload.get("free_cash_flow"),
            free_cash_flow_margin=payload.get("free_cash_flow_margin"),
            debt_to_equity=payload.get("debt_to_equity"),
            current_ratio=payload.get("current_ratio"),
            return_on_equity=payload.get("return_on_equity"),
            trailing_pe=payload.get("trailing_pe"),
            price_to_sales=payload.get("price_to_sales"),
            most_recent_quarter=payload.get("most_recent_quarter"),
            pillars=pillars,
            historical_series=historical_series,
            metric_context=metric_context,
            data_quality_status=data_quality_status,
            data_quality_flags=data_quality_flags,
            red_flags=_sanitize_trend_claims(payload.get("red_flags", []), historical_series),
            highlights=_sanitize_trend_claims(payload.get("highlights", []), historical_series),
            metric_sources={
                str(key): str(value)
                for key, value in (payload.get("metric_sources") or {}).items()
                if str(key).strip() and str(value).strip()
            },
            error=(str(payload.get("error")) if payload.get("error") else None),
        )
