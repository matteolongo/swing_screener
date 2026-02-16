"""Capital tracking and allocation management."""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from swing_screener.portfolio.state import Position
    from swing_screener.execution.orders import Order


@dataclass(frozen=True)
class CapitalState:
    """Portfolio capital allocation state.
    
    Attributes:
        account_size: Total account size from config
        allocated_positions: Capital allocated to open positions (shares * entry_price)
        reserved_orders: Capital reserved by pending entry orders (quantity * limit_price)
        available: Remaining available capital (account_size - allocated - reserved)
        utilization_pct: Portfolio utilization as decimal (allocated + reserved) / account_size
    """
    account_size: float
    allocated_positions: float
    reserved_orders: float
    available: float
    utilization_pct: float


@dataclass(frozen=True)
class CapitalCheck:
    """Result of checking capital availability for a new order.
    
    Attributes:
        is_available: True if sufficient capital is available
        required: Capital required for the new order
        available: Currently available capital
        shortfall: Amount of capital shortage (0 if sufficient)
        reason: Human-readable explanation
    """
    is_available: bool
    required: float
    available: float
    shortfall: float
    reason: str


def compute_capital_state(
    positions: list[Position],
    orders: list[Order],
    account_size: float
) -> CapitalState:
    """Calculate current capital allocation state.
    
    Computes how much capital is:
    - Allocated to open positions
    - Reserved by pending entry orders
    - Available for new orders
    
    Args:
        positions: List of positions (only 'open' status positions are counted)
        orders: List of orders (only 'pending' + 'entry' kind orders are counted)
        account_size: Total account size from configuration
        
    Returns:
        CapitalState with allocation breakdown
        
    Example:
        >>> positions = [Position(ticker="AAPL", status="open", shares=10, entry_price=150.0, ...)]
        >>> orders = [Order(ticker="TSLA", status="pending", order_kind="entry", quantity=2, limit_price=200.0, ...)]
        >>> state = compute_capital_state(positions, orders, 10000.0)
        >>> state.allocated_positions  # 10 * 150 = 1500
        1500.0
        >>> state.reserved_orders  # 2 * 200 = 400
        400.0
        >>> state.available  # 10000 - 1500 - 400 = 8100
        8100.0
    """
    # Calculate capital allocated to open positions
    allocated = sum(
        p.shares * p.entry_price
        for p in positions
        if p.status == "open"
    )
    
    # Calculate capital reserved by pending entry orders
    reserved = sum(
        o.quantity * o.limit_price
        for o in orders
        if o.status == "pending" and o.order_kind == "entry" and o.limit_price is not None
    )
    
    # Calculate available capital
    available = account_size - allocated - reserved
    
    # Calculate utilization percentage
    utilization = (allocated + reserved) / account_size if account_size > 0 else 0.0
    
    return CapitalState(
        account_size=round(account_size, 2),
        allocated_positions=round(allocated, 2),
        reserved_orders=round(reserved, 2),
        available=round(available, 2),
        utilization_pct=round(utilization, 6)
    )


def check_capital_available(
    capital_state: CapitalState,
    required_capital: float
) -> CapitalCheck:
    """Check if sufficient capital is available for a new order.
    
    Args:
        capital_state: Current capital allocation state
        required_capital: Capital required for the new order (quantity * limit_price)
        
    Returns:
        CapitalCheck with availability status and explanation
        
    Example:
        >>> state = CapitalState(account_size=10000, allocated_positions=3000, 
        ...                      reserved_orders=2000, available=5000, utilization_pct=0.50)
        >>> check = check_capital_available(state, required_capital=3000.0)
        >>> check.is_available
        True
        >>> check = check_capital_available(state, required_capital=6000.0)
        >>> check.is_available
        False
        >>> check.shortfall
        1000.0
    """
    is_available = capital_state.available >= required_capital
    shortfall = max(0.0, required_capital - capital_state.available)
    
    if is_available:
        reason = (
            f"Sufficient capital available: ${capital_state.available:.2f} available, "
            f"${required_capital:.2f} required"
        )
    else:
        reason = (
            f"Insufficient capital: need ${required_capital:.2f}, "
            f"have ${capital_state.available:.2f} "
            f"(shortfall: ${shortfall:.2f})"
        )
    
    return CapitalCheck(
        is_available=is_available,
        required=round(required_capital, 2),
        available=round(capital_state.available, 2),
        shortfall=round(shortfall, 2),
        reason=reason
    )
