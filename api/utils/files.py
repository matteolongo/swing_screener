"""File helpers for API JSON storage."""
from __future__ import annotations

from datetime import date


def get_today_str() -> str:
    """Get today's date as YYYY-MM-DD string."""
    return date.today().isoformat()
