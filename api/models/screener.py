"""Screener models."""
from __future__ import annotations

import math
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from api.models.recommendation import Recommendation


class ScreenerCandidate(BaseModel):
    ticker: str
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
    overlay_status: Optional[str] = None
    overlay_reasons: list[str] = Field(default_factory=list)
    overlay_risk_multiplier: Optional[float] = None
    overlay_max_pos_multiplier: Optional[float] = None
    overlay_attention_z: Optional[float] = None
    overlay_sentiment_score: Optional[float] = None
    overlay_sentiment_confidence: Optional[float] = None
    overlay_hype_score: Optional[float] = None
    overlay_sample_size: Optional[int] = None
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


class ScreenerRequest(BaseModel):
    universe: Optional[str] = Field(default=None, description="Named universe (e.g., 'sp500')")
    tickers: Optional[list[str]] = Field(default=None, description="Explicit ticker list")
    top: Optional[int] = Field(default=20, ge=1, le=200, description="Max candidates to return")
    strategy_id: Optional[str] = Field(default=None, description="Strategy id to use (defaults to active)")
    asof_date: Optional[str] = Field(default=None, description="Date for screening (YYYY-MM-DD)")
    min_price: Optional[float] = Field(default=5.0, ge=0, description="Minimum stock price")
    max_price: Optional[float] = Field(default=500.0, gt=0, description="Maximum stock price")
    breakout_lookback: Optional[int] = Field(default=None, gt=0, description="Breakout lookback window")
    pullback_ma: Optional[int] = Field(default=None, gt=0, description="Pullback MA window")
    min_history: Optional[int] = Field(default=None, gt=0, description="Minimum bars required for signals")


class ScreenerResponse(BaseModel):
    candidates: list[ScreenerCandidate]
    asof_date: str
    total_screened: int
    warnings: list[str] = Field(default_factory=list)


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
