"""Portfolio models (positions and orders)."""
from __future__ import annotations

import math
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
    exit_date: Optional[str] = None
    exit_price: Optional[float] = None
    current_price: Optional[float] = None
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
    reason: str = Field(default="", description="Reason for closing")

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


OrderStatus = Literal["pending", "filled", "cancelled"]
OrderKind = Literal["entry", "stop", "take_profit"]

BASE_ORDER_TYPES = {"MARKET", "LIMIT", "STOP", "STOP_LIMIT"}
DIRECTIONAL_ORDER_TYPES = {
    "BUY_MARKET",
    "BUY_LIMIT",
    "BUY_STOP",
    "BUY_STOP_LIMIT",
    "SELL_MARKET",
    "SELL_LIMIT",
    "SELL_STOP",
    "SELL_STOP_LIMIT",
}
SUPPORTED_ORDER_TYPES = BASE_ORDER_TYPES | DIRECTIONAL_ORDER_TYPES

LIMIT_ORDER_TYPES = {"LIMIT", "BUY_LIMIT", "SELL_LIMIT"}
STOP_ORDER_TYPES = {"STOP", "BUY_STOP", "SELL_STOP"}
STOP_LIMIT_ORDER_TYPES = {"STOP_LIMIT", "BUY_STOP_LIMIT", "SELL_STOP_LIMIT"}


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

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("Ticker cannot be empty")
        if len(v) > 10:
            raise ValueError("Ticker must be 10 characters or less")
        if not v.isalnum():
            raise ValueError("Ticker must be alphanumeric")
        return v

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Quantity must be positive")
        if v > 1000000:
            raise ValueError("Quantity exceeds maximum (1,000,000 shares)")
        return v

    @field_validator("limit_price", "stop_price")
    @classmethod
    def validate_price(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return v
        if not math.isfinite(v):
            raise ValueError("Price must be a finite number (not NaN or Inf)")
        if v <= 0:
            raise ValueError("Price must be positive")
        if v > 100000:
            raise ValueError("Price exceeds reasonable maximum (100,000)")
        return v

    @field_validator("order_type")
    @classmethod
    def validate_order_type(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in SUPPORTED_ORDER_TYPES:
            raise ValueError(
                f"Invalid order type: {v}. Must be one of {', '.join(sorted(SUPPORTED_ORDER_TYPES))}"
            )
        return v

    @model_validator(mode="after")
    def validate_order_consistency(self):
        """Validate price fields match order type."""
        if self.order_type in LIMIT_ORDER_TYPES and self.limit_price is None:
            raise ValueError(f"{self.order_type} order requires limit_price")
        if self.order_type in STOP_ORDER_TYPES | STOP_LIMIT_ORDER_TYPES and self.stop_price is None:
            raise ValueError(f"{self.order_type} order requires stop_price")
        if self.order_type in STOP_LIMIT_ORDER_TYPES and self.limit_price is None:
            raise ValueError(f"{self.order_type} order requires both stop_price and limit_price")
        return self


class OrderSnapshot(BaseModel):
    order_id: str
    ticker: str
    status: OrderStatus
    order_type: str
    quantity: int
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    order_kind: Optional[OrderKind] = None
    last_price: Optional[float] = None
    last_bar: Optional[str] = None
    pct_to_limit: Optional[float] = None
    pct_to_stop: Optional[float] = None


class OrdersSnapshotResponse(BaseModel):
    orders: list[OrderSnapshot]
    asof: str


class FillOrderRequest(BaseModel):
    filled_price: float = Field(gt=0, description="Price at which order was filled")
    filled_date: str = Field(description="Date order was filled (YYYY-MM-DD)")
    stop_price: Optional[float] = Field(
        default=None,
        gt=0,
        description="Stop price to use when filling entry orders (optional override)",
    )


class PositionsResponse(BaseModel):
    positions: list[Position]
    asof: str


class OrdersResponse(BaseModel):
    orders: list[Order]
    asof: str
