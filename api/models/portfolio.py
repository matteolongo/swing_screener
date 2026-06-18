"""Portfolio models (positions and orders)."""
from __future__ import annotations

import math
import re
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


PositionStatus = Literal["open", "closed"]
ActionType = Literal["NO_ACTION", "MOVE_STOP_UP", "CLOSE_STOP_HIT", "CLOSE_TIME_EXIT"]
TrailMethod = Literal["sma20", "atr", "fixed_pct", "manual"]


class Position(BaseModel):
    ticker: str
    status: PositionStatus
    entry_date: str
    entry_price: float
    stop_price: float
    target_price: Optional[float] = Field(
        default=None,
        gt=0,
        description="Planned price target captured when the order was placed (for R:R display)",
    )
    shares: int
    position_id: Optional[str] = None
    source_order_id: Optional[str] = None
    initial_risk: Optional[float] = None
    max_favorable_price: Optional[float] = None
    entry_fee_eur: Optional[float] = None
    exit_date: Optional[str] = None
    exit_price: Optional[float] = None
    exit_fee_eur: Optional[float] = None
    current_price: Optional[float] = None
    notes: str = ""
    exit_order_ids: Optional[list[str]] = None
    broker: Optional[str] = None
    broker_product_id: Optional[str] = None
    isin: Optional[str] = None
    broker_synced_at: Optional[str] = None
    thesis: Optional[str] = None
    lesson: Optional[str] = None
    tags: list[str] = Field(default_factory=list, description="Structured trade tags")
    partial_closes: list[PartialCloseEvent] = Field(
        default_factory=list,
        description="Ordered list of partial-close events",
    )
    entry_fx_rate: Optional[float] = Field(
        default=None,
        description="FX rate (EURUSD) at position entry — used for FX-adjusted R display",
    )
    trail_method: TrailMethod = Field(
        default="sma20",
        description="Trail stop method: sma20 | atr | fixed_pct | manual",
    )
    trail_param: Optional[float] = Field(
        default=None,
        description="Trail method parameter (ATR multiplier or fixed % value)",
    )


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
    exhaustion_score: Optional[float] = None
    exhaustion_label: Optional[str] = None


class UpdateStopRequest(BaseModel):
    new_stop: float = Field(gt=0, description="New stop price")
    reason: str = Field(default="", description="Reason for update")

    @field_validator("new_stop")
    @classmethod
    def validate_new_stop(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Stop price must be a finite number (not NaN or Inf)")
        if v <= 0:
            raise ValueError("Stop price must be positive")
        if v > 100000:  # Reasonable upper bound
            raise ValueError("Stop price exceeds reasonable maximum (100,000)")
        return v


class UpdateTrailMethodRequest(BaseModel):
    trail_method: TrailMethod
    trail_param: Optional[float] = Field(
        default=None,
        ge=0,
        description="ATR multiplier (atr) or percentage (fixed_pct); null for sma20/manual",
    )


class PartialCloseEvent(BaseModel):
    """A single partial-close event stored on the position."""
    date: str = Field(..., description="Date of partial close (YYYY-MM-DD)")
    shares_closed: int = Field(..., gt=0, description="Number of shares closed in this leg")
    price: float = Field(..., gt=0, description="Exit price for this leg")
    r_at_close: float = Field(..., description="R-multiple at the time of this partial close")
    fee_eur: Optional[float] = Field(default=None, ge=0, description="Fee for this leg in EUR")


class PartialCloseRequest(BaseModel):
    """Request to partially close an open position."""
    shares_closed: int = Field(..., gt=0, description="Number of shares to close")
    price: float = Field(..., gt=0, description="Exit price for this leg")
    fee_eur: Optional[float] = Field(default=None, ge=0, description="Fee in EUR (optional)")


class ClosePositionRequest(BaseModel):
    exit_price: float = Field(gt=0, description="Exit price")
    fee_eur: Optional[float] = Field(
        default=None,
        ge=0,
        description="Execution fee in EUR (optional)",
    )
    reason: str = Field(default="", description="Reason for closing")
    lesson: Optional[str] = Field(default=None, description="Lesson / reflection (optional)")
    tags: list[str] = Field(default_factory=list, description="Structured tags for this trade")

    @field_validator("exit_price")
    @classmethod
    def validate_exit_price(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Exit price must be a finite number (not NaN or Inf)")
        if v <= 0:
            raise ValueError("Exit price must be positive")
        if v > 100000:
            raise ValueError("Exit price exceeds reasonable maximum (100,000)")
        return v

    @field_validator("fee_eur")
    @classmethod
    def validate_fee_eur(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        if not math.isfinite(v):
            raise ValueError("Fee must be a finite number (not NaN or Inf)")
        if v < 0:
            raise ValueError("Fee cannot be negative")
        if v > 100000:
            raise ValueError("Fee exceeds reasonable maximum (100,000)")
        return v


class StopSuggestionManageConfig(BaseModel):
    breakeven_at_r: float = Field(default=1.0, ge=0)
    trail_after_r: float = Field(default=2.0, ge=0)
    trail_sma: int = Field(default=20, gt=0)
    sma_buffer_pct: float = Field(default=0.005, ge=0)
    max_holding_days: int = Field(default=20, gt=0)
    time_stop_days: int = Field(default=15, gt=0)
    time_stop_min_r: float = Field(default=0.5, ge=0)


class StopSuggestionComputeRequest(BaseModel):
    position: Position
    manage: Optional[StopSuggestionManageConfig] = None


class CreatePositionRequest(BaseModel):
    """Request to manually register a position after a broker fill."""

    ticker: str
    entry_price: float = Field(gt=0, description="Entry fill price")
    stop_price: float = Field(gt=0, description="Initial stop-loss price")
    shares: int = Field(gt=0, description="Number of shares")
    entry_date: str = Field(description="Entry date (YYYY-MM-DD)")
    target_price: Optional[float] = Field(default=None, gt=0, description="Planned price target (optional)")
    thesis: Optional[str] = None
    isin: Optional[str] = None
    notes: str = ""
    fee_eur: Optional[float] = Field(default=None, ge=0, description="Entry fee in EUR (optional)")

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("Ticker cannot be empty")
        if len(v) > 10:
            raise ValueError("Ticker must be 10 characters or less")
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9.-]*", v):
            raise ValueError("Ticker must contain only letters, numbers, dots, or hyphens")
        return v

    @model_validator(mode="after")
    def validate_stop_below_entry(self):
        if self.stop_price >= self.entry_price:
            raise ValueError("stop_price must be below entry_price for a long position")
        return self


class CreateOrderRequest(BaseModel):
    """Request to create a pending entry order."""

    ticker: str
    order_type: str
    quantity: int = Field(gt=0, description="Number of shares")
    limit_price: Optional[float] = Field(default=None, ge=0)
    stop_price: Optional[float] = Field(default=None, ge=0)
    target_price: Optional[float] = Field(default=None, gt=0, description="Planned price target (optional)")
    notes: str = ""
    order_kind: str = "entry"
    position_id: Optional[str] = None
    entry_mode: str = "NEW_ENTRY"
    isin: Optional[str] = None
    thesis: Optional[str] = None

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("Ticker cannot be empty")
        if len(v) > 20:
            raise ValueError("Ticker too long")
        return v

    @field_validator("order_type")
    @classmethod
    def validate_order_type(cls, v: str) -> str:
        return v.strip().upper()


class FillOrderRequest(BaseModel):
    """Request to manually mark a pending order as filled."""
    filled_price: float = Field(gt=0, description="Actual fill price")
    filled_date: str = Field(description="Fill date (YYYY-MM-DD)")
    stop_price: Optional[float] = Field(default=None, gt=0, description="Override stop price from order")
    fee_eur: Optional[float] = Field(default=None, ge=0, description="Execution fee in EUR")
    fill_fx_rate: Optional[float] = Field(default=None, gt=0, description="FX rate at fill")

    @field_validator("filled_price")
    @classmethod
    def validate_filled_price(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Filled price must be finite")
        return v

    @field_validator("filled_date")
    @classmethod
    def validate_filled_date(cls, v: str) -> str:
        import re
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            raise ValueError("filled_date must be in YYYY-MM-DD format")
        return v


class FillOrderResponse(BaseModel):
    order_id: str
    position: Position


class EarningsProximityResponse(BaseModel):
    ticker: str
    next_earnings_date: Optional[str] = Field(default=None, description="Next earnings date as YYYY-MM-DD")
    days_until: Optional[int] = Field(default=None, description="Calendar days until next earnings")
    warning: bool = Field(default=False, description="True when earnings are within the warning window")


class RegimeStats(BaseModel):
    regime: str = Field(..., description="trending_up | trending_down | choppy")
    count: int = Field(..., ge=0)
    win_rate: float = Field(..., ge=0, le=100)
    avg_r: float
    expectancy: float


class RegimeBreakdownResponse(BaseModel):
    regimes: list[RegimeStats]
    benchmark: str


class ConcentrationGroup(BaseModel):
    country: str = Field(..., description="Derived country or market group")
    risk_amount: float = Field(..., description="Open risk amount in this group")
    risk_pct: float = Field(..., description="Share of total open risk as a percentage")
    position_count: int = Field(..., description="Number of open positions in this group")
    warning: bool = Field(..., description="True when concentration exceeds configured threshold")


class PositionsResponse(BaseModel):
    positions: list[Position]
    asof: str


class PositionWithMetrics(Position):
    """Position with precomputed financial metrics."""

    pnl: float = Field(..., description="Absolute profit/loss in dollars")
    fees_eur: float = Field(default=0.0, description="Accumulated execution fees in EUR")
    pnl_percent: float = Field(..., description="P&L as percentage")
    r_now: float = Field(..., description="Current R-multiple")
    entry_value: float = Field(..., description="Total entry value (shares × entry_price)")
    current_value: float = Field(..., description="Current market value (shares × current_price)")
    per_share_risk: float = Field(..., description="Risk per share in dollars")
    total_risk: float = Field(..., description="Total position risk (per_share_risk × shares)")
    days_open: int = Field(default=0, description="Calendar days since entry date")
    time_stop_warning: bool = Field(
        default=False,
        description="True when an open trade is stale and below the configured R threshold",
    )
    r_fx_adjusted: Optional[float] = Field(
        default=None,
        description="R-multiple adjusted for FX movement since entry (null when currencies match or no entry rate stored)",
    )


class PositionsWithMetricsResponse(BaseModel):
    positions: list[PositionWithMetrics]
    asof: str


class PositionMetrics(BaseModel):
    """Calculated metrics for a position."""

    ticker: str = Field(..., description="Stock ticker symbol")
    pnl: float = Field(..., description="Absolute profit/loss in dollars")
    fees_eur: float = Field(default=0.0, description="Accumulated execution fees in EUR")
    pnl_percent: float = Field(..., description="P&L as percentage")
    r_now: float = Field(..., description="Current R-multiple")
    entry_value: float = Field(..., description="Total entry value (shares × entry_price)")
    current_value: float = Field(..., description="Current market value (shares × current_price)")
    per_share_risk: float = Field(..., description="Risk per share in dollars")
    total_risk: float = Field(..., description="Total position risk (per_share_risk × shares)")
    partial_closes: list[PartialCloseEvent] = Field(
        default_factory=list,
        description="Partial-close events recorded on this position",
    )
    blended_r: Optional[float] = Field(
        default=None,
        description="Blended R across all partial closes (None when no partial closes exist)",
    )
    r_fx_adjusted: Optional[float] = Field(
        default=None,
        description="R-multiple adjusted for FX movement since entry",
    )


class PortfolioSummary(BaseModel):
    """Portfolio-level aggregations."""

    total_positions: int = Field(..., description="Number of open positions")
    total_value: float = Field(..., description="Total market value of all open positions")
    total_cost_basis: float = Field(..., description="Total entry value of all open positions")
    total_pnl: float = Field(..., description="Total unrealized P&L across open positions")
    total_fees_eur: float = Field(default=0.0, description="Total execution fees across open positions (EUR)")
    total_pnl_percent: float = Field(..., description="Portfolio unrealized P&L percentage")
    open_risk: float = Field(..., description="Total open risk (sum of position risks)")
    open_risk_percent: float = Field(..., description="Open risk as % of account size")
    account_size: float = Field(..., description="Account size from strategy config")
    available_capital: float = Field(..., description="Account size minus total position value")
    largest_position_value: float = Field(..., description="Value of largest single position")
    largest_position_ticker: str = Field(..., description="Ticker of largest position")
    best_performer_ticker: str = Field(..., description="Ticker with highest P&L %")
    best_performer_pnl_pct: float = Field(..., description="Best P&L percentage")
    worst_performer_ticker: str = Field(..., description="Ticker with lowest P&L %")
    worst_performer_pnl_pct: float = Field(..., description="Worst P&L percentage")
    avg_r_now: float = Field(..., description="Average R-multiple across all positions")
    positions_profitable: int = Field(..., description="Number of positions in profit")
    positions_losing: int = Field(..., description="Number of positions at loss")
    win_rate: float = Field(..., description="Percentage of positions profitable")
    concentration: list[ConcentrationGroup] = Field(default_factory=list)
    realized_pnl: float = Field(default=0.0, description="Total realized P&L from closed positions")
    effective_account_size: float = Field(
        default=0.0,
        description="Account size adjusted for realized P&L when mode=equity",
    )
