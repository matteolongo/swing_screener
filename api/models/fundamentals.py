"""Fundamentals API models."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class FundamentalsConfigModel(BaseModel):
    enabled: bool = True
    providers: list[str] = Field(default_factory=lambda: ["yfinance"])
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
            if provider != "yfinance":
                continue
            seen.add(provider)
            normalized.append(provider)
        return normalized or ["yfinance"]


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
    pillars: dict[str, FundamentalPillarScoreResponse] = Field(default_factory=dict)
    historical_series: dict[str, FundamentalMetricSeriesResponse] = Field(default_factory=dict)
    metric_context: dict[str, FundamentalMetricContextResponse] = Field(default_factory=dict)
    data_quality_status: Literal["high", "medium", "low"] = "low"
    data_quality_flags: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)
    metric_sources: dict[str, str] = Field(default_factory=dict)
    error: Optional[str] = None


class FundamentalRefreshRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=16)

    @field_validator("symbol")
    @classmethod
    def _normalize_symbol(cls, value: str) -> str:
        cleaned = str(value).strip().upper()
        if not cleaned:
            raise ValueError("symbol is required")
        return cleaned


class FundamentalsCompareRequest(BaseModel):
    symbols: list[str] = Field(default_factory=list, min_length=2, max_length=10)
    force_refresh: bool = False

    @field_validator("symbols")
    @classmethod
    def _normalize_symbols(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            symbol = str(value).strip().upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            normalized.append(symbol)
        if len(normalized) < 2:
            raise ValueError("Provide at least two symbols to compare.")
        return normalized


class FundamentalsCompareResponse(BaseModel):
    snapshots: list[FundamentalSnapshotResponse] = Field(default_factory=list)


class FundamentalsWarmupRequest(BaseModel):
    source: Literal["watchlist", "symbols"] = "watchlist"
    symbols: list[str] = Field(default_factory=list, max_length=100)
    force_refresh: bool = False

    @field_validator("symbols")
    @classmethod
    def _normalize_warmup_symbols(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            symbol = str(value).strip().upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            normalized.append(symbol)
        return normalized

    @field_validator("source")
    @classmethod
    def _normalize_source(cls, value: str) -> str:
        return str(value).strip().lower()

    @field_validator("symbols")
    @classmethod
    def _validate_symbols_required_for_symbols_source(cls, values: list[str], info) -> list[str]:
        source = str(info.data.get("source", "watchlist")).strip().lower() if info.data else "watchlist"
        if source == "symbols" and not values:
            raise ValueError("Provide at least one symbol when source='symbols'.")
        return values


class FundamentalsWarmupCoverageCountsResponse(BaseModel):
    supported: int = Field(default=0, ge=0)
    partial: int = Field(default=0, ge=0)
    insufficient: int = Field(default=0, ge=0)
    unsupported: int = Field(default=0, ge=0)


class FundamentalsWarmupFreshnessCountsResponse(BaseModel):
    current: int = Field(default=0, ge=0)
    stale: int = Field(default=0, ge=0)
    unknown: int = Field(default=0, ge=0)


class FundamentalsWarmupLaunchResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "error"]
    source: Literal["watchlist", "symbols"]
    force_refresh: bool = False
    total_symbols: int = Field(default=0, ge=0)
    created_at: str
    updated_at: str


class FundamentalsWarmupStatusResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "error"]
    source: Literal["watchlist", "symbols"]
    force_refresh: bool = False
    total_symbols: int = Field(default=0, ge=0)
    completed_symbols: int = Field(default=0, ge=0)
    coverage_counts: FundamentalsWarmupCoverageCountsResponse = Field(
        default_factory=FundamentalsWarmupCoverageCountsResponse
    )
    freshness_counts: FundamentalsWarmupFreshnessCountsResponse = Field(
        default_factory=FundamentalsWarmupFreshnessCountsResponse
    )
    error_count: int = Field(default=0, ge=0)
    last_completed_symbol: Optional[str] = None
    error_sample: Optional[str] = None
    created_at: str
    updated_at: str
