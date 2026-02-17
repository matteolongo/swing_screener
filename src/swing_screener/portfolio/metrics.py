"""Portfolio position metrics and calculations."""
from __future__ import annotations

from swing_screener.portfolio.state import Position


def calculate_pnl(entry_price: float, current_price: float, shares: int) -> float:
    """Calculate absolute unrealized P&L for a position."""
    return (current_price - entry_price) * shares


def calculate_pnl_percent(entry_price: float, current_price: float) -> float:
    """Calculate percentage P&L for a position."""
    if entry_price == 0:
        return 0.0
    return ((current_price - entry_price) / entry_price) * 100.0


def calculate_per_share_risk(position: Position) -> float:
    """Calculate per-share risk using initial risk when available."""
    if position.initial_risk is not None and position.initial_risk > 0:
        return float(position.initial_risk)
    return float(position.entry_price - position.stop_price)


def calculate_r_now(position: Position, current_price: float) -> float:
    """Calculate current R-multiple for an open position."""
    if position.shares <= 0:
        return 0.0

    per_share_risk = calculate_per_share_risk(position)
    if per_share_risk <= 0:
        return 0.0

    total_risk = per_share_risk * float(position.shares)
    pnl = calculate_pnl(position.entry_price, current_price, position.shares)
    return pnl / total_risk


def calculate_total_position_value(entry_price: float, shares: int) -> float:
    """Calculate total position value at entry (cost basis)."""
    return entry_price * shares


def calculate_current_position_value(current_price: float, shares: int) -> float:
    """Calculate current market value for a position."""
    return current_price * shares
