from datetime import datetime, timezone

from swing_screener.intelligence.market_hours import (
    is_us_pre_market,
    previous_session_close,
)

# 2026-06-23 is a Tuesday; 2026-06-20 is a Saturday; 2026-06-22 Monday; 2026-06-19 Friday.


def _utc(y, m, d, h, mi=0):
    return datetime(y, m, d, h, mi, tzinfo=timezone.utc)


def test_pre_market_true_before_open_on_weekday():
    # Tue 13:00 UTC == 09:00 ET (EDT, UTC-4) — before the 09:30 open.
    assert is_us_pre_market(_utc(2026, 6, 23, 13, 0)) is True


def test_pre_market_false_during_regular_session():
    # Tue 15:00 UTC == 11:00 ET — market open.
    assert is_us_pre_market(_utc(2026, 6, 23, 15, 0)) is False


def test_pre_market_false_after_close():
    # Tue 21:00 UTC == 17:00 ET — after the 16:00 close, same day.
    assert is_us_pre_market(_utc(2026, 6, 23, 21, 0)) is False


def test_pre_market_false_on_weekend():
    # Sat 13:00 UTC == 09:00 ET, but not a trading day.
    assert is_us_pre_market(_utc(2026, 6, 20, 13, 0)) is False


def test_previous_session_close_on_monday_morning_is_friday():
    # Mon 12:00 UTC == 08:00 ET, before open → previous close is the prior Fri 16:00 ET.
    prev = previous_session_close(_utc(2026, 6, 22, 12, 0))
    # Fri 2026-06-19 16:00 ET (EDT) == 20:00 UTC.
    assert prev == _utc(2026, 6, 19, 20, 0)


def test_previous_session_close_after_today_close_is_today():
    # Tue 21:00 UTC == 17:00 ET, after the 16:00 close → today's close.
    prev = previous_session_close(_utc(2026, 6, 23, 21, 0))
    assert prev == _utc(2026, 6, 23, 20, 0)
