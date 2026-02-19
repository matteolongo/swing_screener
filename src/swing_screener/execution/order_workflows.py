from __future__ import annotations

from dataclasses import replace
from typing import Optional

from swing_screener.execution.orders import Order, OrderKind
from swing_screener.portfolio.state import Position, scale_in_position


def _slug_date(value: str) -> str:
    parts = str(value).strip().split("-")
    if len(parts) == 3 and all(p.isdigit() for p in parts):
        return "".join(parts)
    return "UNKNOWN"


def next_position_id(ticker: str, entry_date: str, positions: list[Position]) -> str:
    slug = _slug_date(entry_date)
    used = {p.position_id for p in positions if p.position_id}
    existing = [
        p
        for p in positions
        if p.position_id and p.ticker == ticker and p.entry_date == entry_date
    ]
    seq = len(existing) + 1
    candidate = f"POS-{ticker}-{slug}-{seq:02d}"
    while candidate in used:
        seq += 1
        candidate = f"POS-{ticker}-{slug}-{seq:02d}"
    return candidate


def infer_order_kind(order: Order) -> Optional[OrderKind]:
    if order.order_kind:
        return order.order_kind
    t = order.order_type.upper()
    if t.startswith("BUY_"):
        return "entry"
    if t == "SELL_STOP":
        return "stop"
    if t == "SELL_LIMIT":
        return "take_profit"
    return None


def normalize_orders(orders: list[Order]) -> tuple[list[Order], bool]:
    updated = False
    out: list[Order] = []
    for order in orders:
        order_kind = infer_order_kind(order)
        tif = order.tif or "GTC"
        if order_kind != order.order_kind or tif != order.tif:
            updated = True
        out.append(replace(order, order_kind=order_kind, tif=tif))
    return out, updated


def _find_open_position(
    positions: list[Position],
    ticker: str,
) -> tuple[Optional[int], Optional[Position]]:
    for i, p in enumerate(positions):
        if p.status == "open" and p.ticker == ticker:
            return i, p
    return None, None


def fill_entry_order(
    orders: list[Order],
    positions: list[Position],
    order_id: str,
    *,
    fill_price: float,
    fill_date: str,
    quantity: int,
    stop_price: float,
    tp_price: Optional[float] = None,
    fee_eur: Optional[float] = None,
    fill_fx_rate: Optional[float] = None,
) -> tuple[list[Order], list[Position]]:
    order = next((o for o in orders if o.order_id == order_id), None)
    if order is None:
        raise ValueError(f"Order '{order_id}' not found.")
    if infer_order_kind(order) != "entry":
        raise ValueError("Only entry orders can be filled.")
    if quantity <= 0:
        raise ValueError("quantity must be > 0")
    if fee_eur is not None and fee_eur < 0:
        raise ValueError("fee_eur must be >= 0")
    if fill_fx_rate is not None and fill_fx_rate <= 0:
        raise ValueError("fill_fx_rate must be > 0")
    if stop_price >= fill_price:
        raise ValueError("stop_price must be below fill_price.")

    _, existing = _find_open_position(positions, order.ticker)
    if existing is not None:
        raise ValueError(f"{order.ticker}: open position already exists.")

    position_id = next_position_id(order.ticker, fill_date, positions)
    entry_order = replace(
        order,
        status="filled",
        filled_date=str(fill_date),
        entry_price=float(fill_price),
        quantity=int(quantity),
        stop_price=float(stop_price),
        order_kind="entry",
        position_id=position_id,
        tif=order.tif or "GTC",
        fee_eur=float(fee_eur) if fee_eur not in (None, 0, 0.0) else None,
        fill_fx_rate=float(fill_fx_rate) if fill_fx_rate is not None else None,
    )

    stop_order_id = f"ORD-STOP-{position_id}"
    stop_order = Order(
        order_id=stop_order_id,
        ticker=order.ticker,
        status="pending",
        order_type="SELL_STOP",
        quantity=int(quantity),
        limit_price=None,
        stop_price=float(stop_price),
        order_date=str(fill_date),
        filled_date="",
        entry_price=None,
        notes="auto-linked stop",
        order_kind="stop",
        parent_order_id=entry_order.order_id,
        position_id=position_id,
        tif="GTC",
    )

    exit_ids = [stop_order_id]
    tp_order = None
    if tp_price is not None:
        tp_order_id = f"ORD-TP-{position_id}"
        tp_order = Order(
            order_id=tp_order_id,
            ticker=order.ticker,
            status="pending",
            order_type="SELL_LIMIT",
            quantity=int(quantity),
            limit_price=float(tp_price),
            stop_price=None,
            order_date=str(fill_date),
            filled_date="",
            entry_price=None,
            notes="auto-linked take profit",
            order_kind="take_profit",
            parent_order_id=entry_order.order_id,
            position_id=position_id,
            tif="GTC",
        )
        exit_ids.append(tp_order_id)

    new_position = Position(
        ticker=order.ticker,
        status="open",
        position_id=position_id,
        source_order_id=entry_order.order_id,
        entry_date=str(fill_date),
        entry_price=float(fill_price),
        stop_price=float(stop_price),
        shares=int(quantity),
        initial_risk=float(fill_price - stop_price),
        max_favorable_price=float(fill_price),
        notes=order.notes,
        exit_order_ids=exit_ids,
    )

    new_orders: list[Order] = []
    for o in orders:
        if o.order_id == order_id:
            new_orders.append(entry_order)
        else:
            new_orders.append(o)
    new_orders.append(stop_order)
    if tp_order is not None:
        new_orders.append(tp_order)

    new_positions = list(positions) + [new_position]
    return new_orders, new_positions


def scale_in_fill(
    orders: list[Order],
    positions: list[Position],
    order_id: str,
    *,
    fill_price: float,
    fill_date: str,
    quantity: int,
    fee_eur: Optional[float] = None,
    fill_fx_rate: Optional[float] = None,
) -> tuple[list[Order], list[Position]]:
    order = next((o for o in orders if o.order_id == order_id), None)
    if order is None:
        raise ValueError(f"Order '{order_id}' not found.")
    if infer_order_kind(order) != "entry":
        raise ValueError("Only entry orders can be filled.")
    if quantity <= 0:
        raise ValueError("quantity must be > 0")
    if fee_eur is not None and fee_eur < 0:
        raise ValueError("fee_eur must be >= 0")
    if fill_fx_rate is not None and fill_fx_rate <= 0:
        raise ValueError("fill_fx_rate must be > 0")

    pos_idx, open_pos = _find_open_position(positions, order.ticker)
    if open_pos is None or pos_idx is None:
        raise ValueError(f"{order.ticker}: no open position found to scale into.")

    if open_pos.position_id is None:
        new_id = next_position_id(open_pos.ticker, open_pos.entry_date, positions)
        open_pos = replace(open_pos, position_id=new_id)
        positions = positions[:pos_idx] + [open_pos] + positions[pos_idx + 1 :]

    blended = scale_in_position(
        open_pos,
        add_entry_price=float(fill_price),
        add_shares=int(quantity),
        keep_stop=True,
        recompute_initial_risk=True,
    )
    positions = positions[:pos_idx] + [blended] + positions[pos_idx + 1 :]

    entry_order = replace(
        order,
        status="filled",
        filled_date=str(fill_date),
        entry_price=float(fill_price),
        quantity=int(quantity),
        stop_price=float(blended.stop_price),
        order_kind="entry",
        position_id=blended.position_id,
        tif=order.tif or "GTC",
        fee_eur=float(fee_eur) if fee_eur is not None else None,
        fill_fx_rate=float(fill_fx_rate) if fill_fx_rate is not None else None,
    )

    updated_orders: list[Order] = []
    stop_order_id = None
    for o in orders:
        if o.order_id == order_id:
            updated_orders.append(entry_order)
            continue
        if o.position_id == blended.position_id and infer_order_kind(o) == "stop":
            stop_order_id = o.order_id
            updated_orders.append(
                replace(o, quantity=int(blended.shares), stop_price=float(blended.stop_price))
            )
            continue
        if o.position_id == blended.position_id and infer_order_kind(o) == "take_profit":
            updated_orders.append(replace(o, quantity=int(blended.shares)))
            continue
        updated_orders.append(o)

    if stop_order_id is None:
        stop_order_id = f"ORD-STOP-{blended.position_id}"
        stop_order = Order(
            order_id=stop_order_id,
            ticker=blended.ticker,
            status="pending",
            order_type="SELL_STOP",
            quantity=int(blended.shares),
            limit_price=None,
            stop_price=float(blended.stop_price),
            order_date=str(fill_date),
            filled_date="",
            entry_price=None,
            notes="auto-linked stop (scale-in)",
            order_kind="stop",
            parent_order_id=blended.source_order_id or entry_order.order_id,
            position_id=blended.position_id,
            tif="GTC",
        )
        updated_orders.append(stop_order)

    if blended.exit_order_ids is None:
        exit_ids = [stop_order_id]
    else:
        exit_ids = list(blended.exit_order_ids)
        if stop_order_id not in exit_ids:
            exit_ids.append(stop_order_id)
    blended = replace(blended, exit_order_ids=exit_ids)
    positions = positions[:pos_idx] + [blended] + positions[pos_idx + 1 :]

    return updated_orders, positions
