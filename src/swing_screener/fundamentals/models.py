from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class FundamentalPillarScore:
    score: float | None = None
    status: str = "unavailable"
    summary: str = ""


@dataclass(frozen=True)
class FundamentalSeriesPoint:
    period_end: str
    value: float


@dataclass(frozen=True)
class FundamentalMetricSeries:
    label: str
    unit: str = "number"
    direction: str = "unknown"
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
            historical_series[str(key)] = FundamentalMetricSeries(
                label=str(value.get("label", key)).strip() or str(key),
                unit=str(value.get("unit", "number")).strip() or "number",
                direction=str(value.get("direction", "unknown")).strip() or "unknown",
                points=points,
            )

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
            red_flags=[str(item) for item in payload.get("red_flags", []) if str(item).strip()],
            highlights=[str(item) for item in payload.get("highlights", []) if str(item).strip()],
            metric_sources={
                str(key): str(value)
                for key, value in (payload.get("metric_sources") or {}).items()
                if str(key).strip() and str(value).strip()
            },
            error=(str(payload.get("error")) if payload.get("error") else None),
        )
