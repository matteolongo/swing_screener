from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class OrderPatch(BaseModel):
    model_config = ConfigDict(extra="allow")

    order_id: Optional[str] = Field(default=None, min_length=1)
    status: Optional[str] = None
    order_type: Optional[str] = None
    limit_price: Optional[float] = None
    quantity: Optional[int] = None
    stop_price: Optional[float] = None
    order_date: Optional[str] = None
    filled_date: Optional[str] = None
    entry_price: Optional[float] = None
    notes: Optional[str] = None
    locked: Optional[bool] = None

class PositionPatch(BaseModel):
    model_config = ConfigDict(extra="allow")

    ticker: Optional[str] = Field(default=None, min_length=1)
    status: Optional[str] = None
    stop_price: Optional[float] = None
    locked: Optional[bool] = None

class PreviewRequest(BaseModel):
    orders: list[OrderPatch] = Field(default_factory=list)
    positions: list[PositionPatch] = Field(default_factory=list)


class ApplyRequest(BaseModel):
    orders: list[OrderPatch] = Field(default_factory=list)
    positions: list[PositionPatch] = Field(default_factory=list)


class ScreeningRequest(BaseModel):
    universe: str = "mega"
    top_n: int = 0
    account_size: float = 500.0
    risk_pct: float = 1.0
    k_atr: float = 2.0
    max_position_pct: float = 0.60
    use_cache: bool = True
    force_refresh: bool = False
    min_price: float = 10.0
    max_price: float = 60.0
    max_atr_pct: float = 10.0
    require_trend_ok: bool = True


class ScreeningResponse(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)
    columns: list[str] = Field(default_factory=list)
    csv: str = ""


class HealthResponse(BaseModel):
    status: str = "ok"


class OrdersResponse(BaseModel):
    asof: Optional[str] = None
    orders: list[dict[str, Any]] = Field(default_factory=list)


class PositionsResponse(BaseModel):
    asof: Optional[str] = None
    positions: list[dict[str, Any]] = Field(default_factory=list)
