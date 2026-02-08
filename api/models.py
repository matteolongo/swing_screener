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
    close: float
    sma_20: float
    sma_50: float
    sma_200: float
    atr: float
    momentum_6m: float
    momentum_12m: float
    rel_strength: float
    score: float
    rank: int


class ScreenerRequest(BaseModel):
    universe: Optional[str] = Field(default=None, description="Named universe (e.g., 'sp500')")
    tickers: Optional[list[str]] = Field(default=None, description="Explicit ticker list")
    top: Optional[int] = Field(default=20, description="Max candidates to return")
    asof_date: Optional[str] = Field(default=None, description="Date for screening (YYYY-MM-DD)")
    min_price: Optional[float] = Field(default=5.0, ge=0, description="Minimum stock price")
    max_price: Optional[float] = Field(default=500.0, gt=0, description="Maximum stock price")


class ScreenerResponse(BaseModel):
    candidates: list[ScreenerCandidate]
    asof_date: str
    total_screened: int


# ===== Response Models =====

class PositionsResponse(BaseModel):
    positions: list[Position]
    asof: str


class OrdersResponse(BaseModel):
    orders: list[Order]
    asof: str


class ErrorResponse(BaseModel):
    detail: str
    error_type: Optional[str] = None
