"""API models for the event-study backtest endpoint.

Backend is snake_case; the Web UI transforms to camelCase at the boundary.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class BacktestConfigOverrides(BaseModel):
    """Optional overrides applied on top of the live default config.

    Anything left None keeps the value the live screener/portfolio manager use,
    so an A/B test is two requests differing only in the field under test.
    """

    pattern_stop_enabled: Optional[bool] = None
    pattern_stop_atr_buffer: Optional[float] = None
    breakeven_at_r: Optional[float] = None
    trail_after_r: Optional[float] = None
    trail_sma: Optional[int] = None
    max_holding_days: Optional[int] = None
    exit_signal_days: Optional[int] = None
    k_atr: Optional[float] = None
    rr_target: Optional[float] = None
    breakout_lookback: Optional[int] = None
    pullback_ma: Optional[int] = None
    min_history: Optional[int] = None


class EventStudyRequest(BaseModel):
    tickers: list[str] = Field(default_factory=list)
    start: Optional[str] = None
    end: Optional[str] = None
    config: Optional[BacktestConfigOverrides] = None


class TradeModel(BaseModel):
    ticker: str
    setup: str
    entry_date: str
    entry_price: float
    initial_stop: float
    initial_risk: float
    target: float
    exit_date: str
    exit_price: float
    exit_reason: str
    r_multiple: float
    bars_held: int
    mfe_r: float
    mae_r: float
    pattern_stop_fired: bool


class SetupMetricsModel(BaseModel):
    n_trades: int
    win_rate: float
    expectancy_r: float
    total_r: float
    # None when there are no losing trades (profit factor is infinite).
    profit_factor: Optional[float] = None
    avg_win_r: float
    avg_loss_r: float
    avg_bars_held: float
    max_drawdown_r: float
    exit_reason_counts: dict[str, int] = Field(default_factory=dict)


class BacktestMetricsModel(SetupMetricsModel):
    by_setup: dict[str, SetupMetricsModel] = Field(default_factory=dict)


class EventStudyResponse(BaseModel):
    tickers: list[str]
    start: str
    end: str
    config_used: dict = Field(default_factory=dict)
    trades: list[TradeModel] = Field(default_factory=list)
    metrics: BacktestMetricsModel


class BacktestRunLaunchResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "error"]
    created_at: str
    updated_at: str


class BacktestRunStatusResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "error"]
    result: Optional[EventStudyResponse] = None
    error: Optional[str] = None
    created_at: str
    updated_at: str
