"""Backtest models."""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


class BacktestSummary(BaseModel):
    trades: int
    expectancy_R: float
    winrate: float
    profit_factor_R: float
    max_drawdown_R: float
    avg_R: float
    best_trade_R: Optional[float] = None
    worst_trade_R: Optional[float] = None
    avg_cost_R: Optional[float] = None
    total_cost_R: Optional[float] = None


class BacktestCostSummary(BaseModel):
    commission_pct: float
    slippage_bps: float
    fx_pct: float
    avg_cost_R: Optional[float] = None
    total_cost_R: Optional[float] = None


class BacktestEducation(BaseModel):
    overview: str
    drivers: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)


class BacktestTrade(BaseModel):
    entry_date: str
    entry_price: float
    exit_date: str
    exit_price: float
    R: float
    exit_reason: str


class QuickBacktestRequest(BaseModel):
    ticker: str
    months_back: int = Field(default=12, ge=1, le=360, description="Lookback period in months")
    strategy_id: Optional[str] = Field(default=None, description="Strategy id to use (optional)")
    entry_type: Optional[str] = Field(default=None, description="breakout or pullback (auto-detect if None)")
    k_atr: Optional[float] = Field(default=None, ge=0.5, le=5.0, description="Stop distance multiplier")
    max_holding_days: Optional[int] = Field(default=None, ge=1, description="Maximum days to hold position")


class QuickBacktestResponse(BaseModel):
    ticker: str
    start: str
    end: str
    bars: int
    trades: int
    summary: BacktestSummary
    trades_detail: list[BacktestTrade]
    warnings: list[str]
    costs: Optional[BacktestCostSummary] = None
    education: Optional[BacktestEducation] = None


FullEntryType = Literal["auto", "breakout", "pullback"]


class FullBacktestSummary(BaseModel):
    trades: int
    expectancy_R: Optional[float] = None
    winrate: Optional[float] = None
    profit_factor_R: Optional[float] = None
    max_drawdown_R: Optional[float] = None
    avg_R: Optional[float] = None
    best_trade_R: Optional[float] = None
    worst_trade_R: Optional[float] = None
    avg_cost_R: Optional[float] = None
    total_cost_R: Optional[float] = None


class FullBacktestSummaryByTicker(FullBacktestSummary):
    ticker: str


class FullBacktestTrade(BaseModel):
    ticker: str
    entry_date: str
    entry_price: float
    exit_date: str
    exit_price: float
    R: float
    exit_reason: str
    holding_days: Optional[int] = None
    stop_price: Optional[float] = None


class BacktestCurvePoint(BaseModel):
    date: str
    R: float
    cum_R: float
    ticker: Optional[str] = None


class FullBacktestRequest(BaseModel):
    tickers: list[str]
    start: str
    end: str
    strategy_id: Optional[str] = Field(default=None, description="Strategy id to use (defaults to active)")
    invested_budget: Optional[float] = Field(
        default=None,
        gt=0,
        description="Optional invested budget used for $ P&L estimates (backtest only)",
    )
    entry_type: FullEntryType = "auto"
    breakout_lookback: int = Field(default=50, gt=0)
    pullback_ma: int = Field(default=20, gt=0)
    min_history: int = Field(default=260, gt=0)
    atr_window: int = Field(default=14, gt=0)
    k_atr: float = Field(default=2.0, gt=0)
    breakeven_at_r: float = Field(default=1.0, ge=0)
    trail_after_r: float = Field(default=2.0, ge=0)
    trail_sma: int = Field(default=20, gt=0)
    sma_buffer_pct: float = Field(default=0.005, ge=0)
    max_holding_days: int = Field(default=20, gt=0)
    commission_pct: float = Field(default=0.0, ge=0)
    slippage_bps: float = Field(default=5.0, ge=0)
    fx_pct: float = Field(default=0.0, ge=0)


class FullBacktestResponse(BaseModel):
    tickers: list[str]
    start: str
    end: str
    entry_type: FullEntryType
    summary: FullBacktestSummary
    summary_by_ticker: list[FullBacktestSummaryByTicker]
    trades: list[FullBacktestTrade]
    curve_total: list[BacktestCurvePoint]
    curve_by_ticker: list[BacktestCurvePoint]
    warnings: list[str]
    simulation_id: str
    simulation_name: str
    created_at: str
    costs: Optional[BacktestCostSummary] = None
    education: Optional[BacktestEducation] = None


class BacktestSimulationMeta(BaseModel):
    id: str
    name: str
    created_at: str
    tickers: list[str]
    start: str
    end: str
    entry_type: FullEntryType
    trades: Optional[int] = None


class BacktestSimulation(BaseModel):
    id: str
    name: str
    created_at: str
    params: FullBacktestRequest
    result: FullBacktestResponse
