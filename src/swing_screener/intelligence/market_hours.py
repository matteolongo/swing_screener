"""Minimal US-equity market-hours helper for the pre-open intelligence mode.

Deterministic, stdlib-only (zoneinfo). Excludes weekends and the regular NYSE
holiday calendar (computed, no external dependency), so pre-open mode does not
fire on a closed day and the "previous session close" anchor points at a day the
market was actually open. Early-close half-days are treated as full sessions
(the 16:00 close is only used as a news-window anchor, not for execution).
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from functools import lru_cache
from zoneinfo import ZoneInfo

_DEFAULT_TZ = "America/New_York"


def _parse_hhmm(value: str) -> time:
    hh, mm = value.split(":")
    return time(int(hh), int(mm))


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


def is_us_pre_market(
    now_utc: datetime,
    *,
    market_open: str = "09:30",
    window_start: str = "00:00",
    tz: str = _DEFAULT_TZ,
) -> bool:
    """True when `now_utc` falls in the US pre-open window on a trading day.

    Window = [window_start, market_open) in exchange-local time, trading days only.
    """
    et = now_utc.astimezone(ZoneInfo(tz))
    if not is_us_trading_day(et.date()):
        return False
    return (
        _parse_hhmm(window_start)
        <= et.timetz().replace(tzinfo=None)
        < _parse_hhmm(market_open)
    )


def previous_session_close(
    now_utc: datetime,
    *,
    session_close: str = "16:00",
    tz: str = _DEFAULT_TZ,
) -> datetime:
    """Most recent prior trading-session close, returned in UTC.

    If today is a trading day and the local time is at/after `session_close`,
    today's close is returned; otherwise walk back to the previous trading day's
    close (skipping weekends and market holidays).
    """
    zone = ZoneInfo(tz)
    et = now_utc.astimezone(zone)
    close_t = _parse_hhmm(session_close)

    candidate = et.date()
    today_closed = (
        is_us_trading_day(candidate) and et.timetz().replace(tzinfo=None) >= close_t
    )
    if not today_closed:
        candidate -= timedelta(days=1)
        while not is_us_trading_day(candidate):
            candidate -= timedelta(days=1)

    close_local = datetime.combine(candidate, close_t, tzinfo=zone)
    return close_local.astimezone(ZoneInfo("UTC"))
