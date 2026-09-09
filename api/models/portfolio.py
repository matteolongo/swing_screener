"""Portfolio models (positions and orders)."""

from __future__ import annotations

import math
import re
from typing import Annotated, Literal, Optional

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from api.db.legacy_models import LegacyOrder
from api.models.strategy import Strategy

PositionStatus = Literal["open", "closed"]
ActionType = Literal[
    "NO_ACTION",
    "MOVE_STOP_UP",
    "CLOSE_STOP_HIT",
    "CLOSE_TIME_EXIT",
    "CLOSE_EXIT_SIGNAL",
]
TrailMethod = Literal["sma20", "atr", "fixed_pct", "manual"]


class Position(BaseModel):
    version: int = Field(default=1, ge=1)
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
    exit_fx_rate: Optional[float] = Field(
        default=None,
        description="EURUSD rate at final exit execution (optional)",
    )
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
    quote_currency: Optional[str] = None
    account_currency: Optional[str] = None
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
    shares_closed: int = Field(
        ..., gt=0, description="Number of shares closed in this leg"
    )
    price: float = Field(..., gt=0, description="Exit price for this leg")
    r_at_close: float = Field(
        ..., description="R-multiple at the time of this partial close"
    )
    fee_eur: Optional[float] = Field(
        default=None, ge=0, description="Fee for this leg in EUR"
    )
    fx_rate: Optional[float] = Field(
        default=None,
        gt=0,
        description="EURUSD rate at partial-close execution (optional)",
    )

    @field_validator("fx_rate")
    @classmethod
    def validate_fx_rate(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        if not math.isfinite(v):
            raise ValueError("FX rate must be finite")
        return v


class PartialCloseRequest(BaseModel):
    """Request to partially close an open position."""

    shares_closed: int = Field(..., gt=0, description="Number of shares to close")
    price: float = Field(..., gt=0, description="Exit price for this leg")
    fee_eur: Optional[float] = Field(
        default=None, ge=0, description="Fee in EUR (optional)"
    )
    fx_rate: Optional[float] = Field(
        default=None,
        gt=0,
        description="EURUSD rate at partial-close execution (optional)",
    )

    @field_validator("fx_rate")
    @classmethod
    def validate_fx_rate(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        if not math.isfinite(v):
            raise ValueError("FX rate must be finite")
        return v


class ClosePositionRequest(BaseModel):
    exit_price: float = Field(gt=0, description="Exit price")
    fee_eur: Optional[float] = Field(
        default=None,
        ge=0,
        description="Execution fee in EUR (optional)",
    )
    exit_fx_rate: Optional[float] = Field(
        default=None,
        gt=0,
        description="EURUSD rate at exit execution (optional)",
    )
    reason: str = Field(default="", description="Reason for closing")
    lesson: Optional[str] = Field(
        default=None, description="Lesson / reflection (optional)"
    )
    tags: list[str] = Field(
        default_factory=list, description="Structured tags for this trade"
    )

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

    @field_validator("exit_fx_rate")
    @classmethod
    def validate_exit_fx_rate(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        if not math.isfinite(v):
            raise ValueError("Exit FX rate must be finite")
        return v


class StopSuggestionManageConfig(BaseModel):
    breakeven_at_r: float = Field(default=1.0, ge=0)
    trail_after_r: float = Field(default=2.0, ge=0)
    trail_sma: int = Field(default=20, gt=0)
    sma_buffer_pct: float = Field(default=0.005, ge=0)
    max_holding_days: int = Field(
        default=20,
        gt=0,
        description="Max trading bars to hold before the hard time-exit rule",
    )
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
    target_price: Optional[float] = Field(
        default=None, gt=0, description="Planned price target (optional)"
    )
    thesis: Optional[str] = None
    isin: Optional[str] = None
    notes: str = ""
    fee_eur: Optional[float] = Field(
        default=None, ge=0, description="Entry fee in EUR (optional)"
    )
    quote_currency: Optional[str] = None
    account_currency: Optional[str] = None
    entry_fx_rate: Optional[float] = Field(default=None, gt=0)

    @field_validator(
        "entry_price", "stop_price", "target_price", "fee_eur", "entry_fx_rate"
    )
    @classmethod
    def validate_finite_position_values(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and not math.isfinite(value):
            raise ValueError("position financial values must be finite")
        return value

    @field_validator("quote_currency", "account_currency")
    @classmethod
    def normalize_position_currency(cls, value: Optional[str]) -> Optional[str]:
        normalized = str(value or "").strip().upper()
        return normalized or None

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("Ticker cannot be empty")
        if len(v) > 10:
            raise ValueError("Ticker must be 10 characters or less")
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9.-]*", v):
            raise ValueError(
                "Ticker must contain only letters, numbers, dots, or hyphens"
            )
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
    stop_price: Optional[float] = Field(default=None, gt=0)
    target_price: Optional[float] = Field(
        default=None, gt=0, description="Planned price target (optional)"
    )
    notes: str = ""
    order_kind: Literal["entry", "stop", "take_profit"] = "entry"
    position_id: Optional[str] = None
    entry_mode: str = "NEW_ENTRY"
    isin: Optional[str] = None
    thesis: Optional[str] = None
    setup_status: Literal["PASS", "BLOCK", "UNKNOWN"] = "UNKNOWN"
    trigger_status: Literal["PASS", "WAIT", "BLOCK", "UNKNOWN"] = "UNKNOWN"
    data_status: Literal["current", "stale", "intraday", "unknown"] = "unknown"
    data_asof: Optional[str] = None
    target_source: Literal[
        "structural", "manual", "unknown", "unvalidated_r_multiple"
    ] = "unknown"
    sector: Optional[str] = None
    currency: Optional[str] = None
    account_to_quote_rate: Optional[float] = Field(default=None, gt=0)
    days_to_earnings: Optional[int] = None
    strategy_id: Optional[str] = None
    approval_token: Optional[str] = None

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

    @field_validator(
        "limit_price",
        "stop_price",
        "target_price",
        "account_to_quote_rate",
    )
    @classmethod
    def validate_finite_order_values(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and not math.isfinite(value):
            raise ValueError("order financial values must be finite")
        return value

    @model_validator(mode="after")
    def validate_stop_below_limit(self):
        valid_types = {
            "entry": {"BUY_LIMIT", "BUY_STOP", "BUY_MARKET"},
            "stop": {"SELL_STOP"},
            "take_profit": {"SELL_LIMIT", "SELL_MARKET"},
        }
        if self.order_type not in valid_types[self.order_kind]:
            raise ValueError(
                f"order_kind {self.order_kind!r} is incompatible with order_type {self.order_type!r}"
            )
        # Long entry orders require stop below the limit entry. A protective SELL
        # stop-limit legitimately has stop_price >= limit_price, so skip sells.
        is_sell = self.order_type.upper().startswith("SELL")
        if (
            not is_sell
            and self.stop_price is not None
            and self.limit_price is not None
            and self.stop_price >= self.limit_price
        ):
            raise ValueError(
                "stop_price must be below limit_price for a long entry order"
            )
        return self


class PortfolioApprovalGate(BaseModel):
    status: Literal["PASS", "WARN", "BLOCK"]
    explanation: str
    current: Optional[float] = None
    projected: Optional[float] = None
    limit: Optional[float] = None


class PortfolioOrderApproval(BaseModel):
    approved: bool
    decision: Optional[PortfolioApprovalGate] = None
    coherence: Optional[PortfolioApprovalGate] = None
    reward_risk: Optional[PortfolioApprovalGate] = None
    trade_risk: Optional[PortfolioApprovalGate] = None
    position: Optional[PortfolioApprovalGate] = None
    cash: PortfolioApprovalGate
    heat: PortfolioApprovalGate
    fees: Optional[PortfolioApprovalGate] = None
    fx: Optional[PortfolioApprovalGate] = None
    concentration: PortfolioApprovalGate
    event: PortfolioApprovalGate
    projected_risk: float
    projected_notional: float
    estimated_fees: float = 0.0
    current_exposure: dict[str, float] = Field(default_factory=dict)
    projected_exposure: dict[str, float] = Field(default_factory=dict)
    policy_version: str = "order-risk-v1"
    policy_values: dict[str, float | str] = Field(default_factory=dict)
    token_id: Optional[str] = None
    plan_fingerprint: Optional[str] = None
    verified_context: dict = Field(default_factory=dict)


class FillOrderRequest(BaseModel):
    """Request to manually mark a pending order as filled."""

    filled_price: float = Field(gt=0, description="Actual fill price")
    filled_date: str = Field(description="Fill date (YYYY-MM-DD)")
    stop_price: Optional[float] = Field(
        default=None, gt=0, description="Override stop price from order"
    )
    fee_eur: Optional[float] = Field(
        default=None, ge=0, description="Execution fee in EUR"
    )
    fill_fx_rate: Optional[float] = Field(
        default=None, gt=0, description="FX rate at fill"
    )

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


class OrderReference(BaseModel):
    """A non-blank order identifier for a lifecycle command."""

    order_id: str = Field(min_length=1)

    @field_validator("order_id")
    @classmethod
    def normalize_order_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("order_id must not be blank")
        return normalized


class PositionReference(BaseModel):
    """A non-blank position identifier for a lifecycle command."""

    position_id: str = Field(min_length=1)

    @field_validator("position_id")
    @classmethod
    def normalize_position_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("position_id must not be blank")
        return normalized


class FillOrderCommandPayload(FillOrderRequest, OrderReference):
    """A canonical fill request bound to one order."""


class UpdateStopCommandPayload(UpdateStopRequest, PositionReference):
    """A canonical stop update bound to one position."""


class PartialCloseCommandPayload(PartialCloseRequest, PositionReference):
    """A canonical partial-close request bound to one position."""


class ClosePositionCommandPayload(ClosePositionRequest, PositionReference):
    """A canonical close request bound to one position."""


class CreateOrderCommand(BaseModel):
    operation: Literal["create_order"]
    payload: CreateOrderRequest


class SubmitOrderCommand(BaseModel):
    operation: Literal["submit_order"]
    payload: OrderReference


class CancelOrderCommand(BaseModel):
    operation: Literal["cancel_order"]
    payload: OrderReference


class FillOrderCommand(BaseModel):
    operation: Literal["fill_order"]
    payload: FillOrderCommandPayload


class UpdateStopCommand(BaseModel):
    operation: Literal["update_stop"]
    payload: UpdateStopCommandPayload


class PartialCloseCommand(BaseModel):
    operation: Literal["partial_close"]
    payload: PartialCloseCommandPayload


class ClosePositionCommand(BaseModel):
    operation: Literal["close_position"]
    payload: ClosePositionCommandPayload


TradingCommand = Annotated[
    CreateOrderCommand
    | SubmitOrderCommand
    | CancelOrderCommand
    | FillOrderCommand
    | UpdateStopCommand
    | PartialCloseCommand
    | ClosePositionCommand,
    Field(discriminator="operation"),
]


class TradingStrategySnapshot(Strategy):
    """A non-empty canonical strategy supplied with browser-owned state."""

    model_config = ConfigDict(allow_inf_nan=False)

    @field_validator("id", "name")
    @classmethod
    def require_nonblank_identity(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("strategy identity must not be blank")
        return normalized


class TradingPositionSnapshot(Position):
    """A canonical persisted position with basic state-integrity validation."""

    model_config = ConfigDict(allow_inf_nan=False)

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("ticker must not be blank")
        return normalized

    @field_validator(
        "entry_price", "stop_price", "target_price", "current_price", "exit_price"
    )
    @classmethod
    def require_positive_finite_price(cls, value: float | None) -> float | None:
        if value is None:
            return None
        if not math.isfinite(value) or value <= 0:
            raise ValueError("position prices must be finite and positive")
        return value

    @field_validator("shares")
    @classmethod
    def require_positive_shares(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("shares must be positive")
        return value


class TradingOrderSnapshot(LegacyOrder):
    """A canonical persisted order with basic state-integrity validation."""

    model_config = ConfigDict(extra="allow", allow_inf_nan=False)

    @field_validator("limit_price", "stop_price", "target_price", "entry_price")
    @classmethod
    def require_positive_finite_price(cls, value: float | None) -> float | None:
        if value is None:
            return None
        if not math.isfinite(value) or value <= 0:
            raise ValueError("order prices must be finite and positive")
        return value


class TradingStateSnapshot(BaseModel):
    """The complete browser-owned state supplied to a stateless command."""

    revision: int = Field(default=0, ge=0)
    strategy: TradingStrategySnapshot
    positions: list[TradingPositionSnapshot] = Field(default_factory=list)
    orders: list[TradingOrderSnapshot] = Field(default_factory=list)


class TradingMarketPrice(BaseModel):
    """Fixed price observation for deterministic stop validation."""

    model_config = ConfigDict(allow_inf_nan=False)

    ticker: str = Field(min_length=1)
    price: float = Field(gt=0)
    observed_at: AwareDatetime
    data_status: Literal["current"]

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("ticker must not be blank")
        return normalized


class TradingCommandContext(BaseModel):
    """Explicit business time, identity, and market observation for one command."""

    effective_at: AwareDatetime
    new_position_id: str | None = Field(default=None, min_length=1)
    market_price: TradingMarketPrice | None = None

    @field_validator("new_position_id")
    @classmethod
    def normalize_position_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("new_position_id must not be blank")
        return normalized


class TradingStateCommandRequest(BaseModel):
    """Request envelope for one optimistic, stateless trading transition."""

    snapshot: TradingStateSnapshot
    expected_revision: int = Field(ge=0)
    command: TradingCommand
    context: TradingCommandContext

    @model_validator(mode="after")
    def require_command_context(self):
        if (
            self.command.operation == "update_stop"
            and self.context.market_price is None
        ):
            raise ValueError("market_price is required for update_stop")
        if self.command.operation == "fill_order":
            order = next(
                (
                    order
                    for order in self.snapshot.orders
                    if order.order_id == self.command.payload.order_id
                ),
                None,
            )
            if (
                order is not None
                and not order.position_id
                and not self.context.new_position_id
            ):
                raise ValueError("new_position_id is required for an entry fill")
        return self


class TradingStateCommandResponse(TradingStateSnapshot):
    """The next snapshot and the state records changed by a command."""

    affected_order_ids: list[str] = Field(default_factory=list)
    affected_position_ids: list[str] = Field(default_factory=list)


class EarningsProximityResponse(BaseModel):
    ticker: str
    next_earnings_date: Optional[str] = Field(
        default=None, description="Next earnings date as YYYY-MM-DD"
    )
    days_until: Optional[int] = Field(
        default=None, description="Calendar days until next earnings"
    )
    warning: bool = Field(
        default=False, description="True when earnings are within the warning window"
    )


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
    position_count: int = Field(
        ..., description="Number of open positions in this group"
    )
    warning: bool = Field(
        ..., description="True when concentration exceeds configured threshold"
    )


class PositionsResponse(BaseModel):
    positions: list[Position]
    asof: str


class OrdersSnapshotResponse(BaseModel):
    orders: list[dict[str, object]]
    asof: str
    snapshot_freshness: Literal["fresh", "stale"] = "fresh"
    stale_after_days: int = 1


class PositionWithMetrics(Position):
    """Position with precomputed financial metrics."""

    pnl: float = Field(..., description="Absolute profit/loss in dollars")
    fees_eur: float = Field(
        default=0.0, description="Accumulated execution fees in EUR"
    )
    pnl_percent: float = Field(..., description="P&L as percentage")
    r_now: float = Field(..., description="Current R-multiple")
    entry_value: float = Field(
        ..., description="Total entry value (shares × entry_price)"
    )
    current_value: float = Field(
        ..., description="Current market value (shares × current_price)"
    )
    per_share_risk: float = Field(..., description="Risk per share in dollars")
    total_risk: float = Field(
        ..., description="Total position risk (per_share_risk × shares)"
    )
    days_open: int = Field(default=0, description="Calendar days since entry date")
    time_stop_warning: bool = Field(
        default=False,
        description="True when an open trade is stale and below the configured R threshold",
    )
    r_fx_adjusted: Optional[float] = Field(
        default=None,
        description="R-multiple adjusted for FX movement since entry (null when currencies match or no entry rate stored)",
    )
    price_source: str = Field(
        default="live",
        description="Source of current price: 'live', 'cached', or 'entry'",
    )
    r_uses_initial_risk: bool = Field(
        default=False,
        description="True when R is computed using original entry risk (stop has moved from initial position)",
    )


class PositionsWithMetricsResponse(BaseModel):
    positions: list[PositionWithMetrics]
    asof: str
    snapshot_freshness: Literal["fresh", "stale"] = "fresh"
    stale_after_days: int = 1


class PositionMetrics(BaseModel):
    """Calculated metrics for a position."""

    ticker: str = Field(..., description="Stock ticker symbol")
    pnl: float = Field(..., description="Absolute profit/loss in dollars")
    fees_eur: float = Field(
        default=0.0, description="Accumulated execution fees in EUR"
    )
    pnl_percent: float = Field(..., description="P&L as percentage")
    r_now: float = Field(..., description="Current R-multiple")
    entry_value: float = Field(
        ..., description="Total entry value (shares × entry_price)"
    )
    current_value: float = Field(
        ..., description="Current market value (shares × current_price)"
    )
    per_share_risk: float = Field(..., description="Risk per share in dollars")
    total_risk: float = Field(
        ..., description="Total position risk (per_share_risk × shares)"
    )
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
    price_source: str = Field(
        default="live",
        description="Source of current price: 'live', 'cached', or 'entry'",
    )
    r_uses_initial_risk: bool = Field(
        default=False,
        description="True when R is computed using original entry risk (stop has moved from initial position)",
    )


class PortfolioSummary(BaseModel):
    """Portfolio-level aggregations."""

    total_positions: int = Field(..., description="Number of open positions")
    total_value: float = Field(
        ..., description="Total market value of all open positions"
    )
    total_cost_basis: float = Field(
        ..., description="Total entry value of all open positions"
    )
    total_pnl: float = Field(
        ..., description="Total unrealized P&L across open positions"
    )
    total_fees_eur: float = Field(
        default=0.0, description="Total execution fees across open positions (EUR)"
    )
    total_pnl_percent: float = Field(
        ..., description="Portfolio unrealized P&L percentage"
    )
    open_risk: float = Field(..., description="Total open risk (sum of position risks)")
    open_risk_percent: float = Field(..., description="Open risk as % of account size")
    account_size: float = Field(..., description="Account size from strategy config")
    available_capital: float = Field(
        ..., description="Account size minus total position value"
    )
    largest_position_value: float = Field(
        ..., description="Value of largest single position"
    )
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
    realized_pnl: float = Field(
        default=0.0, description="Total realized P&L from closed positions"
    )
    effective_account_size: float = Field(
        default=0.0,
        description="Account size adjusted for realized P&L when mode=equity",
    )


class TradingStateMetricsResponse(BaseModel):
    """Canonical read models for a supplied browser portfolio; no state mutation."""

    positions: list[PositionWithMetrics]
    summary: PortfolioSummary
