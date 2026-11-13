"""Minimal US-equity market-hours helper for the pre-open intelligence mode.

Deterministic, stdlib-only (zoneinfo). Excludes weekends and the regular NYSE
holiday calendar (``swing_screener.utils.market_calendar``), so pre-open mode does not
fire on a closed day and the "previous session close" anchor points at a day the
market was actually open. Early-close half-days are treated as full sessions
(the 16:00 close is only used as a news-window anchor, not for execution).
"""

from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from swing_screener.utils.market_calendar import is_us_trading_day

__all__ = ["is_us_pre_market", "is_us_trading_day", "previous_session_close"]

_DEFAULT_TZ = "America/New_York"


def _parse_hhmm(value: str) -> time:
    hh, mm = value.split(":")
    return time(int(hh), int(mm))


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
