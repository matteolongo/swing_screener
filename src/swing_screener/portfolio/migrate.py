from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from typing import Optional
import datetime as dt

from swing_screener.execution.orders import Order, load_orders, save_orders
from swing_screener.portfolio.state import Position, load_positions, save_positions


def _slug_date(value: str) -> str:
    try:
        return dt.datetime.strptime(value, "%Y-%m-%d").strftime("%Y%m%d")
    except Exception:
        return "UNKNOWN"


def _generate_position_id(
    ticker: str,
    entry_date: str,
    seq: int,
) -> str:
    slug = _slug_date(entry_date)
    return f"POS-{ticker}-{slug}-{seq:02d}"


def _assign_position_ids(positions: list[Position]) -> tuple[list[Position], bool]:
    used = {p.position_id for p in positions if p.position_id}
    counts: dict[tuple[str, str], int] = {}
    updated = False
    out: list[Position] = []
    for pos in positions:
        if pos.position_id:
            out.append(pos)
            continue
        key = (pos.ticker, pos.entry_date)
        counts[key] = counts.get(key, 0) + 1
        seq = counts[key]
        candidate = _generate_position_id(pos.ticker, pos.entry_date, seq)
        while candidate in used:
            seq += 1
            candidate = _generate_position_id(pos.ticker, pos.entry_date, seq)
        used.add(candidate)
        out.append(replace(pos, position_id=candidate))
        updated = True
    return out, updated


def _infer_order_kind(order: Order) -> Optional[str]:
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


def _normalize_orders(orders: list[Order]) -> tuple[list[Order], bool]:
    updated = False
    out: list[Order] = []
    for order in orders:
        order_kind = _infer_order_kind(order)
        tif = order.tif or "GTC"
        if order_kind != order.order_kind or tif != order.tif:
            updated = True
        out.append(replace(order, order_kind=order_kind, tif=tif))
    return out, updated


def _match_entry_order(position: Position, orders: list[Order]) -> Optional[Order]:
    candidates = [
        o
        for o in orders
        if o.status == "filled"
        and (o.order_kind == "entry" or o.order_kind is None)
        and o.ticker == position.ticker
    ]
    if not candidates:
        return None

    def score(o: Order) -> tuple[int, int]:
        score_date = 1 if o.filled_date == position.entry_date else 0
        score_price = 0
        if position.entry_price and o.entry_price is not None:
            if abs(o.entry_price - position.entry_price) < 1e-6:
                score_price = 1
        return (score_date, score_price)

    candidates.sort(key=score, reverse=True)
    return candidates[0]


def _ensure_exit_ids(position: Position, orders: list[Order]) -> Position:
    exit_ids = set(position.exit_order_ids or [])
    for order in orders:
        if order.position_id != position.position_id:
            continue
        if order.order_kind in {"stop", "take_profit"}:
            exit_ids.add(order.order_id)
    if not exit_ids:
        return position
    return replace(position, exit_order_ids=sorted(exit_ids))


def _backfill_initial_risk(
    position: Position,
    orders: list[Order],
) -> tuple[Position, bool]:
    if position.initial_risk is not None:
        return position, False
    if not position.source_order_id:
        return position, False
    entry = next(
        (o for o in orders if o.order_id == position.source_order_id),
        None,
    )
    if entry is None or entry.stop_price is None:
        return position, False
    if position.entry_price <= entry.stop_price:
        return position, False
    return (
        replace(position, initial_risk=float(position.entry_price - entry.stop_price)),
        True,
    )


def _create_stop_orders(
    positions: list[Position],
    orders: list[Order],
    asof: str,
) -> tuple[list[Order], bool]:
    updated = False
    existing = {
        (o.position_id, o.order_kind)
        for o in orders
        if o.position_id and o.order_kind in {"stop"}
    }
    out = list(orders)
    for pos in positions:
        if pos.position_id is None or pos.stop_price is None:
            continue
        key = (pos.position_id, "stop")
        if key in existing:
            continue
        order_id = f"ORD-STOP-{pos.position_id}"
        new_order = Order(
            order_id=order_id,
            ticker=pos.ticker,
            status="pending",
            order_type="SELL_STOP",
            quantity=pos.shares,
            stop_price=pos.stop_price,
            order_date=asof,
            filled_date="",
            entry_price=None,
            notes="auto-linked stop",
            order_kind="stop",
            parent_order_id=pos.source_order_id,
            position_id=pos.position_id,
            tif="GTC",
        )
        out.append(new_order)
        existing.add(key)
        updated = True
    return out, updated


def migrate_orders_positions(
    orders_path: str | Path,
    positions_path: str | Path,
    create_stop_orders: bool = False,
    asof: Optional[str] = None,
) -> tuple[list[Order], list[Position], bool]:
    asof = asof or str(dt.date.today())
    orders = load_orders(orders_path)
    positions = load_positions(positions_path)

    orders, orders_updated = _normalize_orders(orders)
    positions, positions_updated = _assign_position_ids(positions)

    updated = orders_updated or positions_updated

    # Link positions to filled entry orders
    for i, pos in enumerate(positions):
        if pos.source_order_id:
            continue
        match = _match_entry_order(pos, orders)
        if match is None:
            continue
        positions[i] = replace(pos, source_order_id=match.order_id)
        updated = True

    # Link entry orders to positions
    pos_by_source: dict[str, Position] = {
        p.source_order_id: p for p in positions if p.source_order_id
    }
    linked_orders: list[Order] = []
    for order in orders:
        if order.order_kind != "entry":
            linked_orders.append(order)
            continue
        if order.position_id:
            linked_orders.append(order)
            continue
        pos = pos_by_source.get(order.order_id)
        if pos is None:
            linked_orders.append(order)
            continue
        linked_orders.append(replace(order, position_id=pos.position_id))
        updated = True
    orders = linked_orders

    # Optional: create stop orders for open positions
    if create_stop_orders:
        orders, created = _create_stop_orders(positions, orders, asof)
        updated = updated or created

    # Backfill initial_risk from entry orders, then refresh exit order ids
    new_positions: list[Position] = []
    for p in positions:
        p2, changed = _backfill_initial_risk(p, orders)
        updated = updated or changed
        new_positions.append(p2)
    positions = [_ensure_exit_ids(p, orders) for p in new_positions]

    if updated:
        save_orders(orders_path, orders, asof=asof)
        save_positions(positions_path, positions, asof=asof)

    return orders, positions, updated
