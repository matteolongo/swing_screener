from __future__ import annotations

import json
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
    db = None,
) -> tuple[list[Order], list[Position]]:
    """Fill an entry order and create a position with stop/TP orders.
    
    This function now uses database transactions for atomicity.
    
    Args:
        orders: List of orders (for validation only, will be reloaded from DB)
        positions: List of positions (for validation only, will be reloaded from DB)
        order_id: ID of the order to fill
        fill_price: Price at which order was filled
        fill_date: Date when order was filled
        quantity: Quantity filled
        stop_price: Stop loss price for the new position
        tp_price: Optional take profit price
        db: Database instance (if None, uses default)
        
    Returns:
        Tuple of (updated orders list, updated positions list)
    """
    from swing_screener.db import Database, get_default_db, OrderModel, PositionModel, order_to_model, position_to_model
    from dataclasses import replace
    
    if db is None:
        db = get_default_db()
    
    session = db.get_session()
    try:
        # Validate input order exists
        order = next((o for o in orders if o.order_id == order_id), None)
        if order is None:
            raise ValueError(f"Order '{order_id}' not found.")
        if infer_order_kind(order) != "entry":
            raise ValueError("Only entry orders can be filled.")
        if quantity <= 0:
            raise ValueError("quantity must be > 0")
        if stop_price >= fill_price:
            raise ValueError("stop_price must be below fill_price.")

        # Check for existing open position
        _, existing = _find_open_position(positions, order.ticker)
        if existing is not None:
            raise ValueError(f"{order.ticker}: open position already exists.")

        # Generate position ID
        position_id = next_position_id(order.ticker, fill_date, positions)
        
        # Create updated entry order
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
        )

        # Create stop order
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
        
        # Create optional take profit order
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

        # Create new position
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

        # Database transaction: update order, insert position, insert stop/TP orders
        # Update the entry order
        order_model = session.query(OrderModel).filter_by(order_id=order_id).first()
        if order_model:
            order_model.status = entry_order.status
            order_model.filled_date = entry_order.filled_date
            order_model.entry_price = entry_order.entry_price
            order_model.quantity = entry_order.quantity
            order_model.stop_price = entry_order.stop_price
            order_model.order_kind = entry_order.order_kind
            order_model.position_id_fk = entry_order.position_id
            order_model.tif = entry_order.tif
        else:
            # Order doesn't exist in DB yet, insert it
            session.add(order_to_model(entry_order))

        # Insert new position
        session.add(position_to_model(new_position))
        
        # Insert stop order
        session.add(order_to_model(stop_order))
        
        # Insert TP order if exists
        if tp_order is not None:
            session.add(order_to_model(tp_order))

        # Commit transaction
        session.commit()

        # Reload and return all data
        from swing_screener.db import model_to_order, model_to_position
        all_orders = [model_to_order(m) for m in session.query(OrderModel).all()]
        all_positions = [model_to_position(m) for m in session.query(PositionModel).all()]
        
        return all_orders, all_positions
        
    except Exception as e:
        session.rollback()
        raise
    finally:
        session.close()


def scale_in_fill(
    orders: list[Order],
    positions: list[Position],
    order_id: str,
    *,
    fill_price: float,
    fill_date: str,
    quantity: int,
    db = None,
) -> tuple[list[Order], list[Position]]:
    """Fill a scale-in entry order and update the position.
    
    This function now uses database transactions for atomicity.
    
    Args:
        orders: List of orders (for validation only, will be reloaded from DB)
        positions: List of positions (for validation only, will be reloaded from DB)
        order_id: ID of the order to fill
        fill_price: Price at which order was filled
        fill_date: Date when order was filled
        quantity: Quantity filled
        db: Database instance (if None, uses default)
        
    Returns:
        Tuple of (updated orders list, updated positions list)
    """
    from swing_screener.db import Database, get_default_db, OrderModel, PositionModel, order_to_model, position_to_model
    from dataclasses import replace
    
    if db is None:
        db = get_default_db()
    
    session = db.get_session()
    try:
        # Validate input
        order = next((o for o in orders if o.order_id == order_id), None)
        if order is None:
            raise ValueError(f"Order '{order_id}' not found.")
        if infer_order_kind(order) != "entry":
            raise ValueError("Only entry orders can be filled.")
        if quantity <= 0:
            raise ValueError("quantity must be > 0")

        pos_idx, open_pos = _find_open_position(positions, order.ticker)
        if open_pos is None or pos_idx is None:
            raise ValueError(f"{order.ticker}: no open position found to scale into.")

        if open_pos.position_id is None:
            new_id = next_position_id(open_pos.ticker, open_pos.entry_date, positions)
            open_pos = replace(open_pos, position_id=new_id)

        # Scale in the position
        blended = scale_in_position(
            open_pos,
            add_entry_price=float(fill_price),
            add_shares=int(quantity),
            keep_stop=True,
            recompute_initial_risk=True,
        )

        # Create updated entry order
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
        )

        # Database transaction
        # Update the entry order
        order_model = session.query(OrderModel).filter_by(order_id=order_id).first()
        if order_model:
            order_model.status = entry_order.status
            order_model.filled_date = entry_order.filled_date
            order_model.entry_price = entry_order.entry_price
            order_model.quantity = entry_order.quantity
            order_model.stop_price = entry_order.stop_price
            order_model.order_kind = entry_order.order_kind
            order_model.position_id_fk = entry_order.position_id
            order_model.tif = entry_order.tif
        else:
            session.add(order_to_model(entry_order))

        # Update the position
        pos_model = session.query(PositionModel).filter_by(position_id=blended.position_id).first()
        if pos_model:
            pos_model.entry_price = blended.entry_price
            pos_model.shares = blended.shares
            pos_model.stop_price = blended.stop_price
            pos_model.initial_risk = blended.initial_risk
            pos_model.max_favorable_price = blended.max_favorable_price
            if blended.exit_order_ids:
                pos_model.exit_order_ids = json.dumps(blended.exit_order_ids)
        else:
            session.add(position_to_model(blended))

        # Update stop and TP orders
        stop_order_id = None
        for o in orders:
            if o.position_id == blended.position_id and infer_order_kind(o) == "stop":
                stop_order_id = o.order_id
                stop_model = session.query(OrderModel).filter_by(order_id=o.order_id).first()
                if stop_model:
                    stop_model.quantity = int(blended.shares)
                    stop_model.stop_price = float(blended.stop_price)
            elif o.position_id == blended.position_id and infer_order_kind(o) == "take_profit":
                tp_model = session.query(OrderModel).filter_by(order_id=o.order_id).first()
                if tp_model:
                    tp_model.quantity = int(blended.shares)

        # Create stop order if doesn't exist
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
            session.add(order_to_model(stop_order))

        # Update exit_order_ids
        if blended.exit_order_ids is None:
            exit_ids = [stop_order_id]
        else:
            exit_ids = list(blended.exit_order_ids)
            if stop_order_id not in exit_ids:
                exit_ids.append(stop_order_id)
        
        # Update position with exit_order_ids
        pos_model = session.query(PositionModel).filter_by(position_id=blended.position_id).first()
        if pos_model:
            pos_model.exit_order_ids = json.dumps(exit_ids)

        # Commit transaction
        session.commit()

        # Reload and return all data
        from swing_screener.db import model_to_order, model_to_position
        all_orders = [model_to_order(m) for m in session.query(OrderModel).all()]
        all_positions = [model_to_position(m) for m in session.query(PositionModel).all()]
        
        return all_orders, all_positions
        
    except Exception as e:
        session.rollback()
        raise
    finally:
        session.close()
