"""Fundamentals API models."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from swing_screener.fundamentals.config import SUPPORTED_FUNDAMENTAL_PROVIDERS, TIER1_PROVIDERS


class FundamentalsConfigModel(BaseModel):
    enabled: bool = True
    providers: list[str] = Field(default_factory=lambda: list(TIER1_PROVIDERS))
    cache_ttl_hours: int = Field(default=24, ge=1, le=168)
    stale_after_days: int = Field(default=120, ge=30, le=730)
    compare_limit: int = Field(default=5, ge=2, le=10)

    @field_validator("providers")
    @classmethod
    def _validate_providers(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            provider = str(value).strip().lower()
            if not provider or provider in seen:
                continue
            if provider not in SUPPORTED_FUNDAMENTAL_PROVIDERS:
                continue
            seen.add(provider)
            normalized.append(provider)
        return normalized or list(TIER1_PROVIDERS)


class FundamentalPillarScoreResponse(BaseModel):
    score: Optional[float] = Field(default=None, ge=0, le=1)
    status: Literal["strong", "neutral", "weak", "unavailable"] = "unavailable"
    summary: str = ""


class FundamentalSeriesPointResponse(BaseModel):
    period_end: str
    value: float


class FundamentalMetricContextResponse(BaseModel):
    source: Optional[str] = None
    cadence: Literal["snapshot", "quarterly", "annual", "unknown"] = "unknown"
    derived: bool = False
    derived_from: list[str] = Field(default_factory=list)
    period_end: Optional[str] = None


class FundamentalMetricSeriesResponse(BaseModel):
    label: str
    unit: Literal["number", "currency", "percent", "ratio"] = "number"
    frequency: Literal["quarterly", "annual", "unknown"] = "unknown"
    direction: Literal["improving", "deteriorating", "stable", "unknown", "not_comparable"] = "unknown"
    source: Optional[str] = None
    points: list[FundamentalSeriesPointResponse] = Field(default_factory=list)


class FundamentalSnapshotResponse(BaseModel):
    symbol: str
    asof_date: str
    provider: str
    updated_at: str
    instrument_type: str = "unknown"
    supported: bool = True
    coverage_status: Literal["supported", "partial", "insufficient", "unsupported"] = "insufficient"
    freshness_status: Literal["current", "stale", "unknown"] = "unknown"
    company_name: Optional[str] = None
    sector: Optional[str] = None
    currency: Optional[str] = None
    market_cap: Optional[float] = None
    revenue_growth_yoy: Optional[float] = None
    earnings_growth_yoy: Optional[float] = None
    gross_margin: Optional[float] = None
    operating_margin: Optional[float] = None
    free_cash_flow: Optional[float] = None
    free_cash_flow_margin: Optional[float] = None
    debt_to_equity: Optional[float] = None
    current_ratio: Optional[float] = None
    return_on_equity: Optional[float] = None
    trailing_pe: Optional[float] = None
    price_to_sales: Optional[float] = None
    shares_outstanding: Optional[float] = None
    total_equity: Optional[float] = None
    book_value_per_share: Optional[float] = None
    price_to_book: Optional[float] = None
    book_to_price: Optional[float] = None
    most_recent_quarter: Optional[str] = None
    data_region: Optional[str] = None
    pillars: dict[str, FundamentalPillarScoreResponse] = Field(default_factory=dict)
    historical_series: dict[str, FundamentalMetricSeriesResponse] = Field(default_factory=dict)
    metric_context: dict[str, FundamentalMetricContextResponse] = Field(default_factory=dict)
    data_quality_status: Literal["high", "medium", "low"] = "low"
    data_quality_flags: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)
    metric_sources: dict[str, str] = Field(default_factory=dict)
    error: Optional[str] = None
    # Finnhub enrichment signals (additive, optional)
    net_margin: Optional[float] = None
    insider_net_shares_90d: Optional[int] = None
    insider_transaction_count_90d: Optional[int] = None
    forward_eps_estimate: Optional[float] = None
    analyst_upgrade_downgrade_net_30d: Optional[int] = None


class FundamentalRefreshRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=16)

    @field_validator("symbol")
    @classmethod
    def _normalize_symbol(cls, value: str) -> str:
        cleaned = str(value).strip().upper()
        if not cleaned:
            raise ValueError("symbol is required")
        return cleaned
