"""Screener models."""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


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
