from __future__ import annotations

from typing import Optional

from swing_screener.execution.order_workflows import fill_entry_order, scale_in_fill
from swing_screener.execution.orders import Order
from swing_screener.portfolio.state import Position


def orders_dicts_to_models(orders: list[dict]) -> list[Order]:
    out: list[Order] = []
    for item in orders:
        out.append(
            Order(
                order_id=str(item.get("order_id", "")).strip(),
                ticker=str(item.get("ticker", "")).strip().upper(),
                status=str(item.get("status", "pending")).strip().lower(),  # type: ignore[arg-type]
                order_type=str(item.get("order_type", "")).strip().upper(),
                quantity=int(item.get("quantity", 0) or 0),
                limit_price=(
                    float(item["limit_price"])
                    if item.get("limit_price") is not None
                    else None
                ),
                stop_price=(
                    float(item["stop_price"])
                    if item.get("stop_price") is not None
                    else None
                ),
                order_date=str(item.get("order_date", "")).strip(),
                filled_date=str(item.get("filled_date", "")).strip(),
                entry_price=(
                    float(item["entry_price"])
                    if item.get("entry_price") is not None
                    else None
                ),
                notes=str(item.get("notes", "")).strip(),
                order_kind=item.get("order_kind", None),
                parent_order_id=item.get("parent_order_id", None),
                position_id=item.get("position_id", None),
                tif=item.get("tif", None),
            )
        )
    return out


def orders_models_to_dicts(orders: list[Order]) -> list[dict]:
    out: list[dict] = []
    for o in orders:
        out.append(
            {
                "order_id": o.order_id,
                "ticker": o.ticker,
                "status": o.status,
                "order_kind": o.order_kind,
                "order_type": o.order_type,
                "limit_price": o.limit_price,
                "quantity": o.quantity,
                "stop_price": o.stop_price,
                "order_date": o.order_date,
                "filled_date": o.filled_date,
                "entry_price": o.entry_price,
                "position_id": o.position_id,
                "parent_order_id": o.parent_order_id,
                "tif": o.tif,
                "notes": o.notes,
            }
        )
    return out


def fill_entry_order_dicts(
    orders: list[dict],
    positions: list[Position],
    *,
    order_id: str,
    fill_price: float,
    fill_date: str,
    quantity: int,
    stop_price: float,
    tp_price: Optional[float],
) -> tuple[list[dict], list[Position]]:
    order_models = orders_dicts_to_models(orders)
    new_orders, new_positions = fill_entry_order(
        order_models,
        positions,
        order_id=order_id,
        fill_price=fill_price,
        fill_date=fill_date,
        quantity=quantity,
        stop_price=stop_price,
        tp_price=tp_price,
    )
    return orders_models_to_dicts(new_orders), new_positions


def scale_in_fill_dicts(
    orders: list[dict],
    positions: list[Position],
    *,
    order_id: str,
    fill_price: float,
    fill_date: str,
    quantity: int,
) -> tuple[list[dict], list[Position]]:
    order_models = orders_dicts_to_models(orders)
    new_orders, new_positions = scale_in_fill(
        order_models,
        positions,
        order_id=order_id,
        fill_price=fill_price,
        fill_date=fill_date,
        quantity=quantity,
    )
    return orders_models_to_dicts(new_orders), new_positions
