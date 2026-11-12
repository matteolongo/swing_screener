"""File helpers for API JSON storage."""
from __future__ import annotations

from swing_screener.utils.date_helpers import market_today


def get_today_str() -> str:
    """Get today's date as YYYY-MM-DD string."""
    return market_today().isoformat()
