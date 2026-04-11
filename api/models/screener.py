"""Screener models."""
from __future__ import annotations

import math
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator
from api.models.recommendation import Recommendation
from swing_screener.recommendation.models import DecisionSummary


class PriceHistoryPoint(BaseModel):
    date: str
    close: float


SameSymbolMode = Literal["NEW_ENTRY", "ADD_ON", "MANAGE_ONLY"]


class SameSymbolCandidateContext(BaseModel):
    mode: SameSymbolMode
    position_id: Optional[str] = None
    current_position_entry: Optional[float] = None
    current_position_stop: Optional[float] = None
    fresh_setup_stop: Optional[float] = None
    execution_stop: Optional[float] = None
    pending_entry_exists: bool = False
    add_on_count: int = 0
    max_add_ons: Optional[int] = None
    reason: str = ""


class ScreenerCandidate(BaseModel):
    ticker: str
    currency: str = "USD"
    name: Optional[str] = None
    sector: Optional[str] = None
    last_bar: Optional[str] = None
    close: float
    sma_20: float
    sma_50: float
    sma_200: float
    atr: float
    momentum_6m: float
    momentum_12m: float
    rel_strength: float
    score: float
    confidence: float
    rank: int
    priority_rank: Optional[int] = None
    fundamentals_coverage_status: Optional[str] = None
    fundamentals_freshness_status: Optional[str] = None
    fundamentals_summary: Optional[str] = None
    fundamentals_asof: Optional[str] = None
    intelligence_asof: Optional[str] = None
    # Plan + recommendation fields (education-first)
    signal: Optional[str] = None
    entry: Optional[float] = None
    stop: Optional[float] = None
    target: Optional[float] = None
    rr: Optional[float] = None
    shares: Optional[int] = None
    position_size_usd: Optional[float] = None
    risk_usd: Optional[float] = None
    risk_pct: Optional[float] = None
    recommendation: Optional[Recommendation] = None
    price_history: list[PriceHistoryPoint] = Field(default_factory=list)
    suggested_order_type: Optional[str] = None
    suggested_order_price: Optional[float] = None
    execution_note: Optional[str] = None
    same_symbol: Optional[SameSymbolCandidateContext] = None
    decision_summary: Optional[DecisionSummary] = None
    raw_technical_rank: Optional[int] = None
    combined_priority_score: Optional[float] = None
    sma20_slope: Optional[float] = None
    sma50_slope: Optional[float] = None
    consolidation_tightness: Optional[float] = None
    close_location_in_range: Optional[float] = None
    above_breakout_extension: Optional[float] = None
    breakout_volume_confirmation: Optional[bool] = None


class ScreenerRequest(BaseModel):
    universe: Optional[str] = Field(default=None, description="Named universe (e.g., 'sp500')")
    tickers: Optional[list[str]] = Field(default=None, description="Explicit ticker list")
    top: Optional[int] = Field(default=20, ge=1, le=200, description="Max candidates to return")
    strategy_id: Optional[str] = Field(default=None, description="Strategy id to use (defaults to active)")
    asof_date: Optional[str] = Field(default=None, description="Date for screening (YYYY-MM-DD)")
    min_price: Optional[float] = Field(default=5.0, ge=0, description="Minimum stock price")
    max_price: Optional[float] = Field(default=500.0, gt=0, description="Maximum stock price")
    currencies: Optional[list[str]] = Field(
        default=None,
        description="Allowed currencies (e.g., ['USD'], ['EUR'], ['USD','EUR'])",
    )
    breakout_lookback: Optional[int] = Field(default=None, gt=0, description="Breakout lookback window")
    pullback_ma: Optional[int] = Field(default=None, gt=0, description="Pullback MA window")
    min_history: Optional[int] = Field(default=None, gt=0, description="Minimum bars required for signals")

    @field_validator("currencies")
    @classmethod
    def validate_currencies(cls, values: Optional[list[str]]) -> Optional[list[str]]:
        if values is None:
            return None
        cleaned = [str(v).strip().upper() for v in values if str(v).strip()]
        if not cleaned:
            return ["USD", "EUR"]
        invalid = [v for v in cleaned if v not in {"USD", "EUR"}]
        if invalid:
            raise ValueError(f"Unsupported currency codes: {', '.join(invalid)}")
        return list(dict.fromkeys(cleaned))


class ScreenerResponse(BaseModel):
    candidates: list[ScreenerCandidate]
    asof_date: str
    total_screened: int
    data_freshness: str = "final_close"
    warnings: list[str] = Field(default_factory=list)
    same_symbol_suppressed_count: int = 0
    same_symbol_add_on_count: int = 0


class ScreenerRunLaunchResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "error"]
    created_at: str
    updated_at: str


class ScreenerRunStatusResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "error"]
    result: Optional[ScreenerResponse] = None
    error: Optional[str] = None
    created_at: str
    updated_at: str


class OrderPreview(BaseModel):
    ticker: str
    entry_price: float
    stop_price: float
    atr: float
    shares: int
    position_size_usd: float
    risk_usd: float
    risk_pct: float

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("Ticker cannot be empty")
        if len(v) > 10:
            raise ValueError("Ticker must be 10 characters or less")
        return v

    @field_validator("entry_price", "stop_price", "atr")
    @classmethod
    def validate_price_fields(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Price must be a finite number (not NaN or Inf)")
        if v <= 0:
            raise ValueError("Price must be positive")
        if v > 100000:
            raise ValueError("Price exceeds reasonable maximum (100,000)")
        return v

    @field_validator("risk_pct")
    @classmethod
    def validate_risk_pct(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Risk percentage must be finite")
        if v <= 0 or v >= 1.0:
            raise ValueError("Risk percentage must be between 0 and 1 (0% and 100%)")
        return v

    @field_validator("shares")
    @classmethod
    def validate_shares(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Shares must be positive")
        if v > 1000000:
            raise ValueError("Shares exceed maximum (1,000,000)")
        return v
