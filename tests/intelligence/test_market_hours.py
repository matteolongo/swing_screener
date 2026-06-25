from datetime import date, datetime, timezone

from swing_screener.intelligence.market_hours import (
    is_us_pre_market,
    is_us_trading_day,
    previous_session_close,
)

# 2026-06-23 is a Tuesday; 2026-06-20 is a Saturday; 2026-06-22 Monday; 2026-06-19 Friday (Juneteenth).
# 2026-03-23 Monday, 2026-03-20 Friday (both holiday-free).


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
    prev = previous_session_close(_utc(2026, 3, 23, 12, 0))
    # Fri 2026-03-20 16:00 ET (EDT) == 20:00 UTC.
    assert prev == _utc(2026, 3, 20, 20, 0)


def test_previous_session_close_after_today_close_is_today():
    # Tue 21:00 UTC == 17:00 ET, after the 16:00 close → today's close.
    prev = previous_session_close(_utc(2026, 6, 23, 21, 0))
    assert prev == _utc(2026, 6, 23, 20, 0)


def test_pre_market_false_on_market_holiday():
    # 2026-06-19 is Juneteenth (a Friday). 13:00 UTC == 09:00 ET, would be pre-open
    # on a normal weekday, but the market is closed.
    assert is_us_pre_market(_utc(2026, 6, 19, 13, 0)) is False


def test_previous_session_close_skips_holiday():
    # Mon 2026-06-22 08:00 ET: walk back past the weekend AND Juneteenth (Fri 6/19)
    # to Thursday 2026-06-18 close.
    prev = previous_session_close(_utc(2026, 6, 22, 12, 0))
    assert prev == _utc(2026, 6, 18, 20, 0)


def test_is_us_trading_day_known_holidays():
    assert is_us_trading_day(date(2026, 6, 19)) is False   # Juneteenth
    assert is_us_trading_day(date(2026, 7, 3)) is False     # Independence Day observed (Sat 7/4 -> Fri 7/3)
    assert is_us_trading_day(date(2026, 4, 3)) is False      # Good Friday 2026
    assert is_us_trading_day(date(2026, 11, 26)) is False    # Thanksgiving (4th Thu)
    assert is_us_trading_day(date(2026, 6, 23)) is True      # ordinary Tuesday
