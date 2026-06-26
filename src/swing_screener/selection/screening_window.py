"""Pure helpers for screening-window resolution: market timing, currency, and date math."""
from __future__ import annotations

import datetime as dt
import math
from zoneinfo import ZoneInfo

from swing_screener.data.universe import get_instrument_record

SUPPORTED_CURRENCIES = {"USD", "EUR"}
MARKET_CLOSE_BY_CURRENCY: dict[str, tuple[str, int, int]] = {
    # (IANA timezone, close hour, close minute), with a small post-close buffer.
    "USD": ("America/New_York", 16, 10),
    "EUR": ("Europe/Amsterdam", 17, 40),
}

_FETCH_TRADING_TO_CALENDAR = 1.45
_FETCH_WINDOW_BUFFER_DAYS = 45
_FETCH_MIN_BARS = 260


def normalize_currency_codes(values: list[str] | tuple[str, ...] | None) -> list[str]:
    if not values:
        return []
    cleaned = []
    for value in values:
        code = str(value).strip().upper()
        if code in SUPPORTED_CURRENCIES:
            cleaned.append(code)
    return list(dict.fromkeys(cleaned))


def previous_weekday(day: dt.date) -> dt.date:
    cursor = day - dt.timedelta(days=1)
    while cursor.weekday() >= 5:
        cursor -= dt.timedelta(days=1)
    return cursor


def market_effective_date(currency: str, now_utc: dt.datetime) -> tuple[dt.date, bool]:
    tz_name, close_hour, close_minute = MARKET_CLOSE_BY_CURRENCY.get(
        currency,
        MARKET_CLOSE_BY_CURRENCY["USD"],
    )
    tz = ZoneInfo(tz_name)
    local_now = now_utc.astimezone(tz)
    local_date = local_now.date()

    if local_date.weekday() >= 5:
        return previous_weekday(local_date), True

    close_local = dt.datetime.combine(
        local_date,
        dt.time(hour=close_hour, minute=close_minute),
        tzinfo=tz,
    )
    is_closed = local_now >= close_local
    if is_closed:
        return local_date, True
    return previous_weekday(local_date), False


def infer_currencies_from_tickers(tickers: list[str]) -> list[str]:
    inferred: list[str] = []
    for ticker in tickers:
        rec = get_instrument_record(ticker)
        if not rec:
            continue
        currency = str(rec.get("currency") or "").strip().upper()
        if currency in SUPPORTED_CURRENCIES and currency not in inferred:
            inferred.append(currency)
    return inferred


def resolve_screening_currencies(
    request,
    *,
    strategy_currencies: list[str] | tuple[str, ...] | None,
    tickers: list[str],
    universe_id: str | None = None,
) -> list[str]:
    requested = normalize_currency_codes(request.currencies)
    if requested:
        return requested

    inferred = infer_currencies_from_tickers(tickers)
    if inferred:
        return inferred

    strategy_defaults = normalize_currency_codes(list(strategy_currencies or []))
    if strategy_defaults:
        return strategy_defaults

    if universe_id:
        from swing_screener.data.universe import get_universe_currencies
        universe_currencies = normalize_currency_codes(get_universe_currencies(universe_id))
        if universe_currencies:
            return universe_currencies

    return ["USD", "EUR"]


def resolve_default_asof_date(now_utc: dt.datetime, currencies: list[str]) -> dt.date:
    active = normalize_currency_codes(currencies) or ["USD", "EUR"]
    effective_dates = [market_effective_date(currency, now_utc)[0] for currency in active]
    return min(effective_dates)


def all_markets_closed(now_utc: dt.datetime, currencies: list[str]) -> bool:
    active = normalize_currency_codes(currencies) or ["USD", "EUR"]
    return all(market_effective_date(currency, now_utc)[1] for currency in active)


def resolve_data_freshness(asof_date: str, now_utc: dt.datetime, currencies: list[str]) -> str:
    try:
        resolved = dt.date.fromisoformat(asof_date)
    except ValueError:
        return "final_close"

    if resolved < now_utc.date():
        return "final_close"
    if resolved > now_utc.date():
        return "intraday"
    return "final_close" if all_markets_closed(now_utc, currencies) else "intraday"


def resolve_fetch_start_date(asof_date: str, min_history: int) -> str:
    """Start of the OHLCV fetch window: enough calendar days before asof to
    yield at least max(min_history, 260) trading bars, instead of a fixed
    start date whose window grows unbounded over time."""
    try:
        asof = dt.date.fromisoformat(asof_date)
    except ValueError:
        return "2022-01-01"
    bars_needed = max(int(min_history), _FETCH_MIN_BARS)
    calendar_days = math.ceil(bars_needed * _FETCH_TRADING_TO_CALENDAR) + _FETCH_WINDOW_BUFFER_DAYS
    return (asof - dt.timedelta(days=calendar_days)).isoformat()
