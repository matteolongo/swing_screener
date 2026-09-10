"""Config models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RiskConfig(BaseModel):
    account_size: float = Field(gt=0, description="Total account size in dollars")
    risk_pct: float = Field(
        gt=0, le=1, description="Risk per trade as decimal (e.g., 0.01 = 1%)"
    )
    max_position_pct: float = Field(
        gt=0, le=1, description="Max position size as % of account"
    )
    min_shares: int = Field(ge=1, description="Minimum shares to trade")
    k_atr: float = Field(gt=0, description="ATR multiplier for stops")
    min_rr: float = Field(
        gt=0, default=2.0, description="Minimum reward-to-risk required"
    )
    max_fee_risk_pct: float = Field(
        ge=0, le=1, default=0.2, description="Max fees as % of planned risk"
    )
    max_portfolio_heat_pct: float = Field(
        gt=0, le=1, default=0.06, description="Maximum aggregate open and pending risk"
    )
    max_concentration_pct: float = Field(
        ge=0,
        le=100,
        default=60.0,
        description="Warn when one country/exchange exceeds this share of open risk",
    )
    portfolio_heat_warning_pct: float = Field(
        gt=0,
        le=1,
        default=0.04,
        description="Warn when aggregate open risk reaches this fraction of effective equity",
    )
    account_size_mode: Literal["base", "equity"] = Field(
        default="equity",
        description="Whether risk calculations use base account size or equity adjusted for realized P&L",
    )
    account_currency: Literal["EUR", "USD", "GBP", "CHF", "SEK", "DKK", "NOK"] = Field(
        default="EUR",
        description="Account base currency — used for FX-adjusted R display",
    )


class IndicatorConfig(BaseModel):
    sma_fast: int = Field(gt=0, description="Fast SMA window (e.g., 20)")
    sma_mid: int = Field(gt=0, description="Mid SMA window (e.g., 50)")
    sma_long: int = Field(gt=0, description="Long SMA window (e.g., 200)")
    atr_window: int = Field(gt=0, description="ATR window (e.g., 14)")
    lookback_6m: int = Field(gt=0, description="6-month momentum lookback (e.g., 126)")
    lookback_12m: int = Field(
        gt=0, description="12-month momentum lookback (e.g., 252)"
    )
    benchmark: str = Field(description="Benchmark ticker (e.g., SPY)")
    breakout_lookback: int = Field(
        gt=0, description="Breakout lookback window (e.g., 50)"
    )
    pullback_ma: int = Field(gt=0, description="Pullback MA window (e.g., 20)")
    min_history: int = Field(gt=0, description="Minimum bars required for signals")


class ManageConfig(BaseModel):
    breakeven_at_r: float = Field(ge=0, description="Move stop to entry when R >= this")
    trail_after_r: float = Field(ge=0, description="Start trailing when R >= this")
    trail_sma: int = Field(gt=0, description="SMA to trail under")
    sma_buffer_pct: float = Field(
        ge=0, description="Buffer below SMA (e.g., 0.005 = 0.5%)"
    )
    max_holding_days: int = Field(
        gt=0,
        description="Max trading bars to hold before the hard time-exit rule",
    )
    time_stop_days: int = Field(
        default=15, gt=0, description="Days open before stale-trade nudge appears"
    )
    time_stop_min_r: float = Field(
        default=0.5, ge=0, description="Minimum R that suppresses stale-trade nudge"
    )
    exit_signal_days: int = Field(
        default=2,
        ge=0,
        description="N consecutive closes below SMA triggers advisory exit (0 = disabled)",
    )


class AppConfig(BaseModel):
    risk: RiskConfig
    indicators: IndicatorConfig
    manage: ManageConfig
    positions_file: str = "data/positions.json"
    orders_file: str = "data/orders.json"
    portfolio_snapshot_stale_after_days: int = Field(
        default=1,
        ge=0,
        description="Calendar age after which persisted position/order snapshots are stale",
    )
    portfolio_analytics_min_sample_size: int = Field(
        default=5,
        ge=1,
        description="Minimum closed trades required before a tag analytics row is returned",
    )
    portfolio_analytics_insight_min_trade_count: int = Field(
        default=5,
        ge=1,
        description="Minimum closed trades before a portfolio insight can be conclusive",
    )
    portfolio_analytics_insight_min_profit_factor: float = Field(
        default=1.0,
        ge=0,
        description="Profit-factor threshold for a positive portfolio insight",
    )
    portfolio_analytics_insight_low_win_rate_pct: float = Field(
        default=40.0,
        ge=0,
        le=100,
        description="Win-rate threshold used by the negative portfolio insight",
    )
