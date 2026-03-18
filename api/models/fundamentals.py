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
    most_recent_quarter: Optional[str] = None
    pillars: dict[str, FundamentalPillarScoreResponse] = Field(default_factory=dict)
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
