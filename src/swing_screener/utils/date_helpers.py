"""Date utility functions for dynamic date calculations."""

from datetime import date, datetime, timedelta
from typing import Optional, Union
from zoneinfo import ZoneInfo

import pandas as pd

# The business date of this end-of-day US equity workflow. A post-close review
# in the US evening stays on the session date after UTC midnight, and a server
# in another timezone does not shift it.
MARKET_TIMEZONE = ZoneInfo("America/New_York")


def market_today() -> date:
    """Today's calendar date in the US equity market timezone."""
    return datetime.now(MARKET_TIMEZONE).date()


def get_lookback_start_date(
    years: int = 1,
    from_date: Optional[datetime] = None
) -> str:
    """Get start date for lookback period.
    
    Args:
        years: Number of years to look back
        from_date: Reference date (defaults to today)
    
    Returns:
        ISO format date string (YYYY-MM-DD)
    
    Examples:
        >>> get_lookback_start_date(1)  # doctest: +SKIP
        '2025-02-16'  # if today is 2026-02-16
        >>> get_lookback_start_date(2)  # doctest: +SKIP
        '2024-02-16'  # if today is 2026-02-16
    """
    if from_date is None:
        from_date = datetime.now(MARKET_TIMEZONE)
    
    # Use 365 days per year for simple, deterministic calculation.
    # This provides a consistent lookback period without fractional-day offsets.
    # The small leap year imprecision is acceptable for historical data queries.
    start_date = from_date - timedelta(days=years * 365)
    return start_date.strftime("%Y-%m-%d")


def get_default_history_start(years: int = 1) -> str:
    """Get a default historical start date.
    
    This function provides a dynamic start date for historical lookbacks, avoiding
    hardcoded dates that become stale over time.
    
    Args:
        years: Number of years to look back (default: 1)
    
    Returns:
        ISO format date string (YYYY-MM-DD)
    
    Examples:
        >>> get_default_history_start()  # doctest: +SKIP
        '2025-02-16'  # if today is 2026-02-16
    """
    return get_lookback_start_date(years)


def get_ytd_start_date(from_date: Optional[datetime] = None) -> str:
    """Get year-to-date start date (January 1st of current year).
    
    Args:
        from_date: Reference date (defaults to today)
    
    Returns:
        ISO format date string (YYYY-MM-DD)
    
    Examples:
        >>> get_ytd_start_date()  # doctest: +SKIP
        '2026-01-01'  # if today is 2026-02-16
    """
    if from_date is None:
        from_date = datetime.now(MARKET_TIMEZONE)
    
    return f"{from_date.year}-01-01"


def to_iso_date(timestamp: Union[None, str, datetime, pd.Timestamp]) -> Optional[str]:
    """Convert various date types to ISO format string (YYYY-MM-DD).
    
    Args:
        timestamp: Date/timestamp to convert (None, str, datetime, or pd.Timestamp)
    
    Returns:
        ISO format date string, or None if input is None/NaN
    
    Examples:
        >>> to_iso_date(datetime(2026, 2, 16))
        '2026-02-16'
        >>> to_iso_date('2026-02-16')
        '2026-02-16'
        >>> to_iso_date(None)
        None
    """
    if timestamp is None or (isinstance(timestamp, float) and pd.isna(timestamp)):
        return None
    
    if isinstance(timestamp, str):
        return timestamp
    
    if isinstance(timestamp, pd.Timestamp):
        timestamp = timestamp.to_pydatetime()
    
    if isinstance(timestamp, datetime):
        return timestamp.strftime("%Y-%m-%d")
    
    # Try to convert to string as last resort
    return str(timestamp)
