from __future__ import annotations

from typing import Optional
from dataclasses import replace

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
                fee_eur=(
                    float(item["fee_eur"])
                    if item.get("fee_eur") is not None
                    else None
                ),
                fill_fx_rate=(
                    float(item["fill_fx_rate"])
                    if item.get("fill_fx_rate") is not None
                    else None
                ),
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
                "fee_eur": o.fee_eur,
                "fill_fx_rate": o.fill_fx_rate,
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
    fee_eur: Optional[float] = None,
    fill_fx_rate: Optional[float] = None,
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
        fee_eur=fee_eur,
        fill_fx_rate=fill_fx_rate,
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
    fee_eur: Optional[float] = None,
    fill_fx_rate: Optional[float] = None,
) -> tuple[list[dict], list[Position]]:
    order_models = orders_dicts_to_models(orders)
    new_orders, new_positions = scale_in_fill(
        order_models,
        positions,
        order_id=order_id,
        fill_price=fill_price,
        fill_date=fill_date,
        quantity=quantity,
        fee_eur=fee_eur,
        fill_fx_rate=fill_fx_rate,
    )
    return orders_models_to_dicts(new_orders), new_positions


def fill_exit_order_dicts(
    orders: list[dict],
    positions: list[Position],
    *,
    order_id: str,
    fill_price: float,
    fill_date: str,
    fee_eur: Optional[float] = None,
    fill_fx_rate: Optional[float] = None,
) -> tuple[list[dict], list[Position]]:
    order = next((o for o in orders if o.get("order_id") == order_id), None)
    if order is None:
        raise ValueError(f"Order '{order_id}' not found.")

    order_kind = str(order.get("order_kind", "")).strip().lower()
    order_type = str(order.get("order_type", "")).strip().upper()
    if order_kind not in {"stop", "take_profit"}:
        if order_type == "SELL_STOP":
            order_kind = "stop"
        elif order_type == "SELL_LIMIT":
            order_kind = "take_profit"
        else:
            raise ValueError("Only exit orders can be marked filled.")

    position_id = order.get("position_id")
    pos_idx = None
    pos = None
    if position_id:
        for idx, p in enumerate(positions):
            if p.position_id == position_id:
                pos_idx = idx
                pos = p
                break
    if pos is None:
        ticker = str(order.get("ticker", "")).strip().upper()
        matches = [
            (idx, p)
            for idx, p in enumerate(positions)
            if p.ticker == ticker and p.status == "open"
        ]
        if len(matches) == 1:
            pos_idx, pos = matches[0]
        else:
            raise ValueError("Linked position not found for exit fill.")

    qty = order.get("quantity")
    if qty is not None and pos is not None and int(qty) != int(pos.shares):
        raise ValueError(
            "Exit order quantity does not match position shares (partial exits not supported)."
        )

    order["status"] = "filled"
    order["filled_date"] = str(fill_date)
    order["entry_price"] = float(fill_price)
    order["fee_eur"] = float(fee_eur) if fee_eur is not None else None
    order["fill_fx_rate"] = float(fill_fx_rate) if fill_fx_rate is not None else None
    # Ensure exit order has position_id so fees are properly tracked
    if pos and pos.position_id:
        order["position_id"] = pos.position_id

    positions = list(positions)
    positions[pos_idx] = replace(
        pos,
        status="closed",
        exit_date=str(fill_date),
        exit_price=float(fill_price),
    )
    return orders, positions
