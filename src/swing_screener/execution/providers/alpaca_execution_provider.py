"""Alpaca execution provider using alpaca-py TradingClient."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from alpaca.common.enums import Sort
from alpaca.common.exceptions import APIError
from alpaca.trading.client import TradingClient
from alpaca.trading.enums import OrderSide, OrderType, QueryOrderStatus, TimeInForce
from alpaca.trading.requests import (
    GetOrderByIdRequest,
    GetOrdersRequest,
    LimitOrderRequest,
    MarketOrderRequest,
    StopLimitOrderRequest,
    StopOrderRequest,
)

from .base import (
    ExecutionOrder,
    ExecutionOrderStatus,
    ExecutionPosition,
    ExecutionProvider,
    SubmitOrderRequest,
)


_FILLED_STATUSES = {"filled"}
_CANCELLED_STATUSES = {
    "canceled",
    "cancelled",
    "expired",
    "rejected",
    "done_for_day",
}


def _enum_to_str(value: Any) -> str:
    if value is None:
        return ""
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def _to_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _normalize_status(raw_status: str) -> ExecutionOrderStatus:
    status = raw_status.strip().lower()
    if status in _FILLED_STATUSES:
        return "filled"
    if status in _CANCELLED_STATUSES:
        return "cancelled"
    return "pending"


class AlpacaExecutionProvider(ExecutionProvider):
    """Broker execution provider backed by Alpaca Trading API."""

    def __init__(self, api_key: str, secret_key: str, paper: bool = True):
        self.paper = paper
        self.client = TradingClient(api_key=api_key, secret_key=secret_key, paper=paper)

    def get_provider_name(self) -> str:
        return "alpaca-paper" if self.paper else "alpaca"

    def _map_order(self, order_obj: Any) -> ExecutionOrder:
        raw_status = _enum_to_str(getattr(order_obj, "status", ""))
        side_raw = _enum_to_str(getattr(order_obj, "side", "buy")).lower()
        side = "sell" if side_raw == "sell" else "buy"

        order_type_raw = (
            _enum_to_str(getattr(order_obj, "order_type", ""))
            or _enum_to_str(getattr(order_obj, "type", ""))
        ).lower()
        order_type_map = {
            "market": "market",
            "limit": "limit",
            "stop": "stop",
            "stop_limit": "stop_limit",
        }
        order_type = order_type_map.get(order_type_raw, "market")

        order_id = str(getattr(order_obj, "id", "")).strip()
        if not order_id:
            # Fallback for dict-like payloads.
            order_id = str(getattr(order_obj, "client_order_id", "")).strip()

        return ExecutionOrder(
            order_id=order_id,
            ticker=str(getattr(order_obj, "symbol", "")).upper(),
            status=_normalize_status(raw_status),
            side=side,  # type: ignore[arg-type]
            order_type=order_type,  # type: ignore[arg-type]
            quantity=_to_float(getattr(order_obj, "qty", None), default=0.0) or 0.0,
            filled_quantity=_to_float(getattr(order_obj, "filled_qty", None), default=0.0) or 0.0,
            limit_price=_to_float(getattr(order_obj, "limit_price", None)),
            stop_price=_to_float(getattr(order_obj, "stop_price", None)),
            tif=_enum_to_str(getattr(order_obj, "time_in_force", "gtc")).lower(),
            submitted_at=_to_iso(getattr(order_obj, "submitted_at", None)),
            filled_at=_to_iso(getattr(order_obj, "filled_at", None)),
            avg_fill_price=_to_float(getattr(order_obj, "filled_avg_price", None)),
            client_order_id=str(getattr(order_obj, "client_order_id", "")) or None,
            raw_status=raw_status or None,
        )

    def _map_position(self, position_obj: Any) -> ExecutionPosition:
        return ExecutionPosition(
            ticker=str(getattr(position_obj, "symbol", "")).upper(),
            quantity=_to_float(getattr(position_obj, "qty", None), default=0.0) or 0.0,
            avg_entry_price=_to_float(getattr(position_obj, "avg_entry_price", None), default=0.0) or 0.0,
            current_price=_to_float(getattr(position_obj, "current_price", None)),
            market_value=_to_float(getattr(position_obj, "market_value", None)),
            unrealized_pl=_to_float(getattr(position_obj, "unrealized_pl", None)),
        )

    def list_orders(
        self,
        status: Optional[ExecutionOrderStatus] = None,
        ticker: Optional[str] = None,
    ) -> list[ExecutionOrder]:
        request = GetOrdersRequest(
            status=QueryOrderStatus.ALL,
            limit=500,
            direction=Sort.DESC,
            nested=False,
            symbols=[ticker.upper()] if ticker else None,
        )
        orders = self.client.get_orders(filter=request)
        mapped = [self._map_order(order_obj) for order_obj in orders]
        if status:
            mapped = [order for order in mapped if order.status == status]
        return mapped

    def get_order(self, order_id: str) -> ExecutionOrder:
        order = self.client.get_order_by_id(
            order_id=order_id,
            filter=GetOrderByIdRequest(nested=False),
        )
        return self._map_order(order)

    def submit_order(self, request: SubmitOrderRequest) -> ExecutionOrder:
        side = OrderSide.BUY if request.side == "buy" else OrderSide.SELL
        tif_map = {
            "day": TimeInForce.DAY,
            "gtc": TimeInForce.GTC,
            "ioc": TimeInForce.IOC,
            "fok": TimeInForce.FOK,
            "opg": TimeInForce.OPG,
            "cls": TimeInForce.CLS,
        }
        time_in_force = tif_map.get(request.tif.lower(), TimeInForce.GTC)
        order_type = request.order_type.lower()

        if order_type == "market":
            order_data = MarketOrderRequest(
                symbol=request.ticker.upper(),
                qty=request.quantity,
                side=side,
                type=OrderType.MARKET,
                time_in_force=time_in_force,
                client_order_id=request.client_order_id,
            )
        elif order_type == "limit":
            if request.limit_price is None:
                raise ValueError("limit_price is required for limit orders")
            order_data = LimitOrderRequest(
                symbol=request.ticker.upper(),
                qty=request.quantity,
                side=side,
                limit_price=request.limit_price,
                type=OrderType.LIMIT,
                time_in_force=time_in_force,
                client_order_id=request.client_order_id,
            )
        elif order_type == "stop":
            if request.stop_price is None:
                raise ValueError("stop_price is required for stop orders")
            order_data = StopOrderRequest(
                symbol=request.ticker.upper(),
                qty=request.quantity,
                side=side,
                stop_price=request.stop_price,
                type=OrderType.STOP,
                time_in_force=time_in_force,
                client_order_id=request.client_order_id,
            )
        elif order_type == "stop_limit":
            if request.stop_price is None or request.limit_price is None:
                raise ValueError("stop_limit orders require both stop_price and limit_price")
            order_data = StopLimitOrderRequest(
                symbol=request.ticker.upper(),
                qty=request.quantity,
                side=side,
                stop_price=request.stop_price,
                limit_price=request.limit_price,
                type=OrderType.STOP_LIMIT,
                time_in_force=time_in_force,
                client_order_id=request.client_order_id,
            )
        else:
            raise ValueError(f"Unsupported order_type '{request.order_type}'")

        order = self.client.submit_order(order_data=order_data)
        return self._map_order(order)

    def cancel_order(self, order_id: str) -> None:
        self.client.cancel_order_by_id(order_id=order_id)

    def list_positions(self) -> list[ExecutionPosition]:
        positions = self.client.get_all_positions()
        return [self._map_position(position_obj) for position_obj in positions]

    def get_open_position(self, ticker: str) -> Optional[ExecutionPosition]:
        try:
            position = self.client.get_open_position(symbol_or_asset_id=ticker.upper())
        except APIError as exc:
            if getattr(exc, "status_code", None) == 404:
                return None
            raise
        return self._map_position(position)

