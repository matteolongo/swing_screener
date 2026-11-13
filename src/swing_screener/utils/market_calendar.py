"""Regular NYSE trading calendar, computed with the standard library only.

Excludes weekends and the regular full-day NYSE holidays (observed dates).
Early-close half-days count as trading days. Unscheduled closures (e.g. a
national day of mourning) are not modelled.
"""

from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """The n-th `weekday` (Mon=0) of `month` in `year` (n starts at 1)."""
    first = date(year, month, 1)
    offset = (weekday - first.weekday()) % 7
    return first + timedelta(days=offset + 7 * (n - 1))


def _last_weekday(year: int, month: int, weekday: int) -> date:
    """The last `weekday` (Mon=0) of `month` in `year`."""
    if month == 12:
        nxt = date(year + 1, 1, 1)
    else:
        nxt = date(year, month + 1, 1)
    last = nxt - timedelta(days=1)
    return last - timedelta(days=(last.weekday() - weekday) % 7)


def _easter(year: int) -> date:
    """Gregorian Easter Sunday (Anonymous Gregorian / Meeus algorithm)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    p = (32 + 2 * e + 2 * i - h - k) % 7
    q = (a + 11 * h + 22 * p) // 451
    month = (h + p - 7 * q + 114) // 31
    day = ((h + p - 7 * q + 114) % 31) + 1
    return date(year, month, day)


def _observed(holiday: date) -> date:
    """NYSE weekend-observance: Saturday -> prior Friday, Sunday -> next Monday."""
    if holiday.weekday() == 5:  # Saturday
        return holiday - timedelta(days=1)
    if holiday.weekday() == 6:  # Sunday
        return holiday + timedelta(days=1)
    return holiday


@lru_cache(maxsize=64)
def _us_market_holidays(year: int) -> frozenset[date]:
    """Regular full-day NYSE market closures for `year` (observed dates)."""
    days = {
        _observed(date(year, 1, 1)),  # New Year's Day
        _nth_weekday(year, 1, 0, 3),  # MLK Jr Day (3rd Mon Jan)
        _nth_weekday(year, 2, 0, 3),  # Washington's Birthday (3rd Mon Feb)
        _easter(year) - timedelta(days=2),  # Good Friday
        _last_weekday(year, 5, 0),  # Memorial Day (last Mon May)
        _nth_weekday(year, 9, 0, 1),  # Labor Day (1st Mon Sep)
        _nth_weekday(year, 11, 3, 4),  # Thanksgiving (4th Thu Nov)
        _observed(date(year, 7, 4)),  # Independence Day
        _observed(date(year, 12, 25)),  # Christmas Day
    }
    if year >= 2022:  # Juneteenth became a market holiday in 2022
        days.add(_observed(date(year, 6, 19)))
    return frozenset(days)


def is_us_trading_day(d: date) -> bool:
    """Weekday that is not a regular NYSE holiday."""
    return d.weekday() < 5 and d not in _us_market_holidays(d.year)


def previous_us_trading_day(day: date) -> date:
    """The last NYSE trading day strictly before ``day``."""
    cursor = day - timedelta(days=1)
    while not is_us_trading_day(cursor):
        cursor -= timedelta(days=1)
    return cursor
