"""Minimal US-equity market-hours helper for the pre-open intelligence mode.

Deterministic, stdlib-only (zoneinfo). Holiday handling is best-effort:
weekends are excluded; market holidays are not — a qualitative pre-open read
on a holiday simply finds no fresh tape, which degrades gracefully.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

_DEFAULT_TZ = "America/New_York"


def _parse_hhmm(value: str) -> time:
    hh, mm = value.split(":")
    return time(int(hh), int(mm))


def _is_weekday(dt: datetime) -> bool:
    return dt.weekday() < 5  # Mon=0 .. Fri=4


def is_us_pre_market(
    now_utc: datetime,
    *,
    market_open: str = "09:30",
    window_start: str = "00:00",
    tz: str = _DEFAULT_TZ,
) -> bool:
    """True when `now_utc` falls in the US pre-open window on a trading weekday.

    Window = [window_start, market_open) in exchange-local time, weekdays only.
    """
    et = now_utc.astimezone(ZoneInfo(tz))
    if not _is_weekday(et):
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
    """Most recent prior weekday session close, returned in UTC.

    If today is a weekday and the local time is at/after `session_close`, today's
    close is returned; otherwise walk back to the previous weekday's close.
    """
    zone = ZoneInfo(tz)
    et = now_utc.astimezone(zone)
    close_t = _parse_hhmm(session_close)

    candidate = et.date()
    if not (_is_weekday(et) and et.timetz().replace(tzinfo=None) >= close_t):
        # Step back to the previous calendar day, then to the previous weekday.
        candidate = candidate - timedelta(days=1)
        while candidate.weekday() >= 5:
            candidate = candidate - timedelta(days=1)
    else:
        # Today qualifies, but guard the (unreachable for weekdays) edge anyway.
        while candidate.weekday() >= 5:
            candidate = candidate - timedelta(days=1)

    close_local = datetime.combine(candidate, close_t, tzinfo=zone)
    return close_local.astimezone(now_utc.tzinfo or ZoneInfo("UTC"))
