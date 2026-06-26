"""Unit tests for swing_screener.selection.screening_window pure helpers."""
import datetime as dt

from swing_screener.selection.screening_window import (
    normalize_currency_codes,
    previous_weekday,
    market_effective_date,
    resolve_default_asof_date,
    all_markets_closed,
    resolve_data_freshness,
    resolve_fetch_start_date,
)


# --- normalize_currency_codes ---

def test_normalize_currency_codes_uppercases_and_strips():
    result = normalize_currency_codes(["usd", " eur "])
    assert result == ["USD", "EUR"]


def test_normalize_currency_codes_deduplicates():
    result = normalize_currency_codes(["USD", "usd", "USD"])
    assert result == ["USD"]


def test_normalize_currency_codes_filters_unsupported():
    result = normalize_currency_codes(["USD", "JPY", "GBP"])
    assert result == ["USD"]


def test_normalize_currency_codes_none_returns_empty():
    assert normalize_currency_codes(None) == []


def test_normalize_currency_codes_empty_returns_empty():
    assert normalize_currency_codes([]) == []


# --- previous_weekday ---

def test_previous_weekday_monday_returns_friday():
    monday = dt.date(2026, 6, 22)  # Monday
    assert previous_weekday(monday) == dt.date(2026, 6, 19)  # Friday


def test_previous_weekday_tuesday_returns_monday():
    tuesday = dt.date(2026, 6, 23)
    assert previous_weekday(tuesday) == dt.date(2026, 6, 22)


def test_previous_weekday_sunday_returns_friday():
    sunday = dt.date(2026, 6, 21)
    assert previous_weekday(sunday) == dt.date(2026, 6, 19)


def test_previous_weekday_saturday_returns_friday():
    saturday = dt.date(2026, 6, 20)
    assert previous_weekday(saturday) == dt.date(2026, 6, 19)


# --- market_effective_date ---

def test_market_effective_date_eur_before_close():
    # 2026-02-19 15:00 UTC = 16:00 Amsterdam (before 17:40 close)
    now_utc = dt.datetime(2026, 2, 19, 15, 0, tzinfo=dt.timezone.utc)
    date, is_closed = market_effective_date("EUR", now_utc)
    assert date == dt.date(2026, 2, 18)  # previous weekday
    assert is_closed is False


def test_market_effective_date_eur_after_close():
    # 2026-02-19 18:00 UTC = 19:00 Amsterdam (after 17:40 close)
    now_utc = dt.datetime(2026, 2, 19, 18, 0, tzinfo=dt.timezone.utc)
    date, is_closed = market_effective_date("EUR", now_utc)
    assert date == dt.date(2026, 2, 19)
    assert is_closed is True


def test_market_effective_date_weekend():
    # 2026-06-20 is Saturday
    now_utc = dt.datetime(2026, 6, 20, 12, 0, tzinfo=dt.timezone.utc)
    date, is_closed = market_effective_date("USD", now_utc)
    assert date == dt.date(2026, 6, 19)  # Friday
    assert is_closed is True


# --- resolve_default_asof_date ---

def test_resolve_default_asof_date_before_eur_close():
    now_utc = dt.datetime(2026, 2, 19, 15, 0, tzinfo=dt.timezone.utc)
    result = resolve_default_asof_date(now_utc, ["EUR"])
    assert result == dt.date(2026, 2, 18)


def test_resolve_default_asof_date_after_eur_close():
    now_utc = dt.datetime(2026, 2, 19, 18, 0, tzinfo=dt.timezone.utc)
    result = resolve_default_asof_date(now_utc, ["EUR"])
    assert result == dt.date(2026, 2, 19)


def test_resolve_default_asof_date_multi_currency_takes_min():
    # EUR closes at 17:40 Amsterdam; USD closes at 16:10 New York
    # At 15:00 UTC on a weekday: both markets open → prev weekday for both
    now_utc = dt.datetime(2026, 2, 19, 15, 0, tzinfo=dt.timezone.utc)
    result = resolve_default_asof_date(now_utc, ["USD", "EUR"])
    assert result == dt.date(2026, 2, 18)


# --- all_markets_closed ---

def test_all_markets_closed_false_before_any_close():
    now_utc = dt.datetime(2026, 2, 19, 15, 0, tzinfo=dt.timezone.utc)
    assert all_markets_closed(now_utc, ["EUR"]) is False


def test_all_markets_closed_true_after_close():
    now_utc = dt.datetime(2026, 2, 19, 18, 0, tzinfo=dt.timezone.utc)
    assert all_markets_closed(now_utc, ["EUR"]) is True


# --- resolve_data_freshness ---

def test_resolve_data_freshness_past_date():
    now_utc = dt.datetime(2026, 2, 20, 12, 0, tzinfo=dt.timezone.utc)
    assert resolve_data_freshness("2026-02-19", now_utc, ["EUR"]) == "final_close"


def test_resolve_data_freshness_today_before_close():
    now_utc = dt.datetime(2026, 2, 19, 15, 0, tzinfo=dt.timezone.utc)
    assert resolve_data_freshness("2026-02-19", now_utc, ["EUR"]) == "intraday"


def test_resolve_data_freshness_today_after_close():
    now_utc = dt.datetime(2026, 2, 19, 18, 0, tzinfo=dt.timezone.utc)
    assert resolve_data_freshness("2026-02-19", now_utc, ["EUR"]) == "final_close"


def test_resolve_data_freshness_invalid_date():
    now_utc = dt.datetime(2026, 2, 19, 12, 0, tzinfo=dt.timezone.utc)
    assert resolve_data_freshness("not-a-date", now_utc, ["EUR"]) == "final_close"


# --- resolve_fetch_start_date ---

def test_resolve_fetch_start_date_covers_min_history():
    start = resolve_fetch_start_date("2026-03-02", 260)
    asof = dt.date.fromisoformat("2026-03-02")
    window_days = (asof - dt.date.fromisoformat(start)).days
    assert window_days >= 260 * 1.4
    assert window_days <= 600


def test_resolve_fetch_start_date_grows_with_min_history():
    short = resolve_fetch_start_date("2026-03-02", 260)
    long = resolve_fetch_start_date("2026-03-02", 400)
    assert dt.date.fromisoformat(long) < dt.date.fromisoformat(short)


def test_resolve_fetch_start_date_invalid_asof():
    assert resolve_fetch_start_date("not-a-date", 260) == "2022-01-01"
