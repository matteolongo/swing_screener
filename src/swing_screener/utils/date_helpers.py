"""Date utility functions for dynamic date calculations."""

from datetime import datetime, timedelta
from typing import Optional


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
        from_date = datetime.now()
    
    # Use 365.25 to account for leap years
    start_date = from_date - timedelta(days=years * 365.25)
    return start_date.strftime("%Y-%m-%d")


def get_default_backtest_start(years: int = 1) -> str:
    """Get default start date for backtests.
    
    This function provides a dynamic start date for backtests, avoiding
    hardcoded dates that become stale over time.
    
    Args:
        years: Number of years to look back (default: 1)
    
    Returns:
        ISO format date string (YYYY-MM-DD)
    
    Examples:
        >>> get_default_backtest_start()  # doctest: +SKIP
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
        from_date = datetime.now()
    
    return f"{from_date.year}-01-01"
