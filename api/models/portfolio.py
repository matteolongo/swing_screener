"""Portfolio models (positions and orders)."""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


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


class ClosePositionRequest(BaseModel):
    exit_price: float = Field(gt=0, description="Exit price")
    reason: str = Field(default="", description="Reason for closing")


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
