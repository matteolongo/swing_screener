"""Portfolio models (positions and orders)."""
from __future__ import annotations

import math
import re
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


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


class ClosePositionRequest(BaseModel):
    exit_price: float = Field(gt=0, description="Exit price")
    fee_eur: Optional[float] = Field(
        default=None,
        ge=0,
        description="Execution fee in EUR (optional)",
    )
    reason: str = Field(default="", description="Reason for closing")
    lesson: Optional[str] = Field(default=None, description="Lesson / reflection (optional)")

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


class StopSuggestionComputeRequest(BaseModel):
    position: Position
    manage: Optional[StopSuggestionManageConfig] = None


DegiroAvailabilityMode = Literal["ready", "missing_library", "missing_credentials"]


class CreatePositionRequest(BaseModel):
    """Request to manually register a position after a DeGiro fill."""

    ticker: str
    entry_price: float = Field(gt=0, description="Entry fill price")
    stop_price: float = Field(gt=0, description="Initial stop-loss price")
    shares: int = Field(gt=0, description="Number of shares")
    entry_date: str = Field(description="Entry date (YYYY-MM-DD)")
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


class DegiroOrder(BaseModel):
    """Live order read from DeGiro API (read-only)."""

    order_id: str
    product_id: Optional[str] = None
    isin: Optional[str] = None
    product_name: Optional[str] = None
    status: str
    price: Optional[float] = None
    quantity: int
    order_type: Optional[str] = None
    side: Optional[str] = None
    created_at: Optional[str] = None


class DegiroOrdersResponse(BaseModel):
    orders: list[DegiroOrder]
    asof: str


class DegiroStatus(BaseModel):
    installed: bool
    credentials_configured: bool
    available: bool
    mode: DegiroAvailabilityMode
    detail: str


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


# ---------------------------------------------------------------------------
# DeGiro sync request / response models (Phase 2)
# ---------------------------------------------------------------------------

class DegiroSyncRequest(BaseModel):
    from_date: str = Field(description="Start date (YYYY-MM-DD)")
    to_date: str = Field(description="End date (YYYY-MM-DD)")
    include_portfolio: bool = True
    include_orders_history: bool = True
    include_transactions: bool = True


class SyncDiffResponse(BaseModel):
    kind: str
    action: str
    local_id: Optional[str] = None
    broker_id: Optional[str] = None
    confidence: str
    fields: dict = Field(default_factory=dict)


class DegiroSyncPreviewResponse(BaseModel):
    positions_to_create: list[SyncDiffResponse] = Field(default_factory=list)
    positions_to_update: list[SyncDiffResponse] = Field(default_factory=list)
    orders_to_create: list[SyncDiffResponse] = Field(default_factory=list)
    orders_to_update: list[SyncDiffResponse] = Field(default_factory=list)
    fees_applied: int = 0
    ambiguous: list[SyncDiffResponse] = Field(default_factory=list)
    unmatched: list[SyncDiffResponse] = Field(default_factory=list)
    artifact_paths: dict[str, str] = Field(default_factory=dict)


class DegiroApplyResponse(BaseModel):
    positions_created: int = 0
    positions_updated: int = 0
    orders_created: int = 0
    orders_updated: int = 0
    fees_applied: int = 0
    ambiguous_skipped: int = 0
    artifact_paths: dict[str, str] = Field(default_factory=dict)
