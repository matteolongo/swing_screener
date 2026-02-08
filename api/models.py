"""Pydantic models for API requests/responses."""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


# ===== Config Models =====

class RiskConfig(BaseModel):
    account_size: float = Field(gt=0, description="Total account size in dollars")
    risk_pct: float = Field(gt=0, le=1, description="Risk per trade as decimal (e.g., 0.01 = 1%)")
    max_position_pct: float = Field(gt=0, le=1, description="Max position size as % of account")
    min_shares: int = Field(ge=1, description="Minimum shares to trade")
    k_atr: float = Field(gt=0, description="ATR multiplier for stops")


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
    positions_file: str = "positions.json"
    orders_file: str = "orders.json"


# ===== Position Models =====

PositionStatus = Literal["open", "closed"]
ActionType = Literal["NO_ACTION", "MOVE_STOP_UP", "CLOSE_STOP_HIT", "CLOSE_TIME_EXIT"]


class Position(BaseModel):
    ticker: str
    status: PositionStatus
    entry_date: str
    entry_price: float
    stop_price: float
    shares: int
    position_id: Optional[str] = None
    source_order_id: Optional[str] = None
    initial_risk: Optional[float] = None
    max_favorable_price: Optional[float] = None
    exit_date: Optional[str] = None
    exit_price: Optional[float] = None
    current_price: Optional[float] = None  # Added: live price for open positions
    notes: str = ""
    exit_order_ids: Optional[list[str]] = None


class PositionUpdate(BaseModel):
    ticker: str
    status: PositionStatus
    last: float
    entry: float
    stop_old: float
    stop_suggested: float
    shares: int
    r_now: float
    action: ActionType
    reason: str


class UpdateStopRequest(BaseModel):
    new_stop: float = Field(gt=0, description="New stop price")
    reason: str = Field(default="", description="Reason for update")


class ClosePositionRequest(BaseModel):
    exit_price: float = Field(gt=0, description="Exit price")
    reason: str = Field(default="", description="Reason for closing")


# ===== Order Models =====

OrderStatus = Literal["pending", "filled", "cancelled"]
OrderKind = Literal["entry", "stop", "take_profit"]


class Order(BaseModel):
    order_id: str
    ticker: str
    status: OrderStatus
    order_type: str
    quantity: int
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    order_date: str = ""
    filled_date: str = ""
    entry_price: Optional[float] = None
    notes: str = ""
    order_kind: Optional[OrderKind] = None
    parent_order_id: Optional[str] = None
    position_id: Optional[str] = None
    tif: Optional[str] = None


class CreateOrderRequest(BaseModel):
    ticker: str
    order_type: str
    quantity: int
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    notes: str = ""
    order_kind: OrderKind = "entry"


class FillOrderRequest(BaseModel):
    filled_price: float = Field(gt=0, description="Price at which order was filled")
    filled_date: str = Field(description="Date order was filled (YYYY-MM-DD)")


class OrderPreview(BaseModel):
    ticker: str
    entry_price: float
    stop_price: float
    atr: float
    shares: int
    position_size_usd: float
    risk_usd: float
    risk_pct: float


# ===== Screener Models =====

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


class ScreenerRequest(BaseModel):
    universe: Optional[str] = Field(default=None, description="Named universe (e.g., 'sp500')")
    tickers: Optional[list[str]] = Field(default=None, description="Explicit ticker list")
    top: Optional[int] = Field(default=20, ge=1, le=200, description="Max candidates to return")
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


# ===== Response Models =====

class PositionsResponse(BaseModel):
    positions: list[Position]
    asof: str


class OrdersResponse(BaseModel):
    orders: list[Order]
    asof: str


# ===== Backtest Models =====

class BacktestSummary(BaseModel):
    trades: int
    expectancy_R: float
    winrate: float
    profit_factor_R: float
    max_drawdown_R: float
    avg_R: float
    best_trade_R: Optional[float] = None
    worst_trade_R: Optional[float] = None


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


# ===== Full Backtest Models =====

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


class ErrorResponse(BaseModel):
    detail: str
    error_type: Optional[str] = None
