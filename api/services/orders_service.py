"""Orders service - local order lifecycle management."""
from __future__ import annotations

import uuid
import logging
from typing import Optional

from swing_screener.errors import (
    NotFoundError,
    ConflictError,
    UnprocessableError,
)

from api.models.portfolio import (
    CreateOrderRequest,
    FillOrderRequest,
    FillOrderResponse,
    Position,
)
from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.utils.files import get_today_str

logger = logging.getLogger(__name__)


def _resolve_isin(ticker: str) -> Optional[str]:
    return None


class OrdersService:
    def __init__(
        self,
        orders_repo: OrdersRepository,
        positions_repo: PositionsRepository,
    ) -> None:
        self._orders_repo = orders_repo
        self._positions_repo = positions_repo

    def create_order(self, request: CreateOrderRequest) -> dict:
        ticker = request.ticker.upper()
        orders, _ = self._orders_repo.list_orders()

        if request.order_kind == "entry":
            pending_entry = any(
                o.get("ticker") == ticker
                and o.get("status") in ("pending", "submitted")
                and o.get("order_kind") == "entry"
                for o in orders
            )
            if pending_entry:
                raise ConflictError(f"{ticker}: pending entry order already exists.")

            positions, _ = self._positions_repo.list_positions(status="open")
            open_position = next((p for p in positions if p.get("ticker") == ticker), None)

            if request.entry_mode == "ADD_ON":
                if not open_position:
                    raise ConflictError(f"{ticker}: no open position found for add-on order.")
            elif open_position:
                raise ConflictError(
                    f"{ticker}: open position already exists. Create this as an ADD_ON order instead.",
                )

        existing_ids = {o.get("order_id", "") for o in orders}
        base = f"ORD-{ticker}"
        n = 1
        order_id = f"{base}-{n:03d}"
        while order_id in existing_ids:
            n += 1
            order_id = f"{base}-{n:03d}"

        isin = request.isin or _resolve_isin(ticker)
        order = {
            "order_id": order_id,
            "ticker": ticker,
            "status": "pending",
            "order_type": request.order_type,
            "quantity": request.quantity,
            "limit_price": request.limit_price,
            "stop_price": request.stop_price,
            "order_date": get_today_str(),
            "filled_date": None,
            "entry_price": None,
            "notes": request.notes.strip(),
            "order_kind": request.order_kind,
            "parent_order_id": None,
            "position_id": request.position_id if request.entry_mode == "ADD_ON" else None,
            "tif": "GTC",
            "fee_eur": None,
            "fill_fx_rate": None,
            "isin": isin,
            "thesis": request.thesis,
        }
        self._orders_repo.append_order(order)
        return order

    def list_local_orders(self, status: Optional[str] = None) -> dict:
        orders, asof = self._orders_repo.list_orders(status=status)
        return {"orders": orders, "asof": asof}

    def submit_order(self, order_id: str) -> dict:
        order = self._orders_repo.submit_order(order_id)
        if order is None:
            raise NotFoundError(f"Order {order_id} not found")
        if order.get("status") != "submitted":
            raise ConflictError(f"Order {order_id} is already {order.get('status')}")
        return {"order_id": order_id, "status": "submitted"}

    def cancel_order(self, order_id: str) -> dict:
        order = self._orders_repo.cancel_order(order_id)
        if order is None:
            raise NotFoundError(f"Order {order_id} not found")
        if order.get("status") != "cancelled":
            raise ConflictError(f"Order {order_id} is already {order.get('status')}")
        return {"order_id": order_id, "status": "cancelled"}

    def fill_order(self, order_id: str, request: FillOrderRequest) -> FillOrderResponse:
        order = self._orders_repo.get_order(order_id)
        if order is None:
            raise NotFoundError(f"Order {order_id} not found")
        if order.get("status") not in ("pending", "submitted"):
            raise ConflictError(f"Order {order_id} is already {order.get('status')}")

        ticker = order["ticker"]
        stop_price = request.stop_price if request.stop_price is not None else order.get("stop_price")
        if not stop_price or stop_price <= 0:
            raise UnprocessableError(f"No valid stop price for order {order_id}")
        if stop_price >= request.filled_price:
            raise UnprocessableError("stop_price must be below filled_price")

        updates = {
            "status": "filled",
            "entry_price": request.filled_price,
            "filled_date": request.filled_date,
            "fee_eur": request.fee_eur,
            "fill_fx_rate": request.fill_fx_rate,
            "stop_price": stop_price,
        }
        self._orders_repo.update_order(order_id, updates)

        isin = order.get("isin") or _resolve_isin(ticker)
        position_id = f"POS-{uuid.uuid4().hex[:8].upper()}"
        initial_risk = round(request.filled_price - stop_price, 4)

        new_position: dict = {
            "position_id": position_id,
            "ticker": ticker,
            "status": "open",
            "entry_date": request.filled_date,
            "entry_price": request.filled_price,
            "stop_price": stop_price,
            "shares": order["quantity"],
            "initial_risk": initial_risk,
            "source_order_id": order_id,
            "isin": isin,
            "thesis": order.get("thesis"),
            "notes": order.get("notes", ""),
            "entry_fee_eur": request.fee_eur,
            "entry_fx_rate": request.fill_fx_rate,
        }

        data = self._positions_repo.read()
        positions = data.get("positions", [])
        positions.append(new_position)
        data["positions"] = positions
        data["asof"] = get_today_str()
        self._positions_repo.write(data)

        return FillOrderResponse(order_id=order_id, position=Position(**new_position))
