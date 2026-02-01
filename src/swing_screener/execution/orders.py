from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Optional
import json


OrderStatus = Literal["pending", "filled", "cancelled"]
OrderKind = Literal["entry", "stop", "take_profit"]


@dataclass
class Order:
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
    commission: Optional[float] = None
    notes: str = ""
    order_kind: Optional[OrderKind] = None
    parent_order_id: Optional[str] = None
    position_id: Optional[str] = None
    tif: Optional[str] = None


def load_orders(path: str | Path) -> list[Order]:
    p = Path(path)
    data = json.loads(p.read_text(encoding="utf-8"))
    out: list[Order] = []
    for idx, item in enumerate(data.get("orders", [])):
        ticker = str(item.get("ticker", "")).strip().upper()
        if not ticker:
            continue
        order_id = str(item.get("order_id", "")).strip() or f"{ticker}-{idx + 1}"
        status_raw = str(item.get("status", "pending")).strip().lower()
        status = status_raw if status_raw in {"pending", "filled", "cancelled"} else "pending"
        order_kind_raw = str(item.get("order_kind", "")).strip().lower()
        order_kind = (
            order_kind_raw
            if order_kind_raw in {"entry", "stop", "take_profit"}
            else None
        )

        out.append(
            Order(
                order_id=order_id,
                ticker=ticker,
                status=status,
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
                commission=(
                    float(item["commission"])
                    if item.get("commission") is not None
                    else None
                ),
                notes=str(item.get("notes", "")).strip(),
                order_kind=order_kind,
                parent_order_id=item.get("parent_order_id", None),
                position_id=item.get("position_id", None),
                tif=item.get("tif", None),
            )
        )
    return out


def save_orders(path: str | Path, orders: list[Order], asof: Optional[str] = None) -> None:
    p = Path(path)
    payload = {
        "asof": asof,
        "orders": [
            {
                "order_id": o.order_id,
                "ticker": o.ticker,
                "status": o.status,
                "order_type": o.order_type,
                "limit_price": o.limit_price,
                "quantity": o.quantity,
                "stop_price": o.stop_price,
                "order_date": o.order_date,
                "filled_date": o.filled_date,
                "entry_price": o.entry_price,
                "commission": o.commission,
                "notes": o.notes,
                "order_kind": o.order_kind,
                "parent_order_id": o.parent_order_id,
                "position_id": o.position_id,
                "tif": o.tif,
            }
            for o in orders
        ],
    }
    p.write_text(json.dumps(payload, indent=2), encoding="utf-8")
