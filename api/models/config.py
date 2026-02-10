"""Config models."""
from __future__ import annotations

from pydantic import BaseModel, Field


class RiskConfig(BaseModel):
    account_size: float = Field(gt=0, description="Total account size in dollars")
    risk_pct: float = Field(gt=0, le=1, description="Risk per trade as decimal (e.g., 0.01 = 1%)")
    max_position_pct: float = Field(gt=0, le=1, description="Max position size as % of account")
    min_shares: int = Field(ge=1, description="Minimum shares to trade")
    k_atr: float = Field(gt=0, description="ATR multiplier for stops")
    min_rr: float = Field(gt=0, default=2.0, description="Minimum reward-to-risk required")
    max_fee_risk_pct: float = Field(ge=0, le=1, default=0.2, description="Max fees as % of planned risk")


class IndicatorConfig(BaseModel):
    sma_fast: int = Field(gt=0, description="Fast SMA window (e.g., 20)")
    sma_mid: int = Field(gt=0, description="Mid SMA window (e.g., 50)")
    sma_long: int = Field(gt=0, description="Long SMA window (e.g., 200)")
    atr_window: int = Field(gt=0, description="ATR window (e.g., 14)")
    lookback_6m: int = Field(gt=0, description="6-month momentum lookback (e.g., 126)")
    lookback_12m: int = Field(gt=0, description="12-month momentum lookback (e.g., 252)")
    benchmark: str = Field(description="Benchmark ticker (e.g., SPY)")
    breakout_lookback: int = Field(gt=0, description="Breakout lookback window (e.g., 50)")
    pullback_ma: int = Field(gt=0, description="Pullback MA window (e.g., 20)")
    min_history: int = Field(gt=0, description="Minimum bars required for signals")


class ManageConfig(BaseModel):
    breakeven_at_r: float = Field(ge=0, description="Move stop to entry when R >= this")
    trail_after_r: float = Field(ge=0, description="Start trailing when R >= this")
    trail_sma: int = Field(gt=0, description="SMA to trail under")
    sma_buffer_pct: float = Field(ge=0, description="Buffer below SMA (e.g., 0.005 = 0.5%)")
    max_holding_days: int = Field(gt=0, description="Max days to hold position")


class AppConfig(BaseModel):
    risk: RiskConfig
    indicators: IndicatorConfig
    manage: ManageConfig
    positions_file: str = "data/positions.json"
    orders_file: str = "data/orders.json"
