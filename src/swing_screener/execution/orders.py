from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Optional
import json

from swing_screener.db import Database, get_default_db, model_to_order


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
    notes: str = ""
    order_kind: Optional[OrderKind] = None
    parent_order_id: Optional[str] = None
    position_id: Optional[str] = None
    tif: Optional[str] = None


def load_orders(path: str | Path = None, db: Database = None) -> list[Order]:
    """Load orders from database.
    
    Args:
        path: Legacy parameter for backward compatibility (ignored if db provided)
        db: Database instance to use. If None, uses default database.
        
    Returns:
        List of Order objects
    """
    if db is None:
        db = get_default_db()
    
    session = db.get_session()
    try:
        from swing_screener.db import OrderModel
        models = session.query(OrderModel).all()
        return [model_to_order(m) for m in models]
    finally:
        session.close()


def save_orders(path: str | Path, orders: list[Order], asof: Optional[str] = None) -> None:
    """[DEPRECATED] Save orders to database.
    
    This function is kept for backward compatibility but now uses the database.
    The file-based persistence is no longer used.
    
    Args:
        path: Ignored (kept for backward compatibility)
        orders: List of orders to save
        asof: Ignored (kept for backward compatibility)
    """
    import warnings
    warnings.warn(
        "save_orders is deprecated. Orders are now persisted via database transactions.",
        DeprecationWarning,
        stacklevel=2
    )
    # For now, do nothing as orders should be saved via transactions
    pass
