from __future__ import annotations

import datetime as dt
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx
import yfinance as yf

logger = logging.getLogger(__name__)

_FINNHUB_EARNINGS_URL = "https://finnhub.io/api/v1/calendar/earnings"
_TIMEOUT = 10.0
_UNAVAILABLE = object()
_AUTH_FAILED = object()


def _is_auth_error(exc: Exception) -> bool:
    return (
        isinstance(exc, httpx.HTTPStatusError)
        and exc.response.status_code in {401, 403}
    )


def _fetch_via_finnhub(ticker: str, api_key: str, asof_date: dt.date) -> int | None | object:
    end = asof_date + dt.timedelta(days=90)
    try:
        resp = httpx.get(
            _FINNHUB_EARNINGS_URL,
            params={
                "symbol": ticker,
                "from": asof_date.isoformat(),
                "to": end.isoformat(),
                "token": api_key,
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        items = resp.json().get("earningsCalendar") or []
    except Exception as exc:
        if _is_auth_error(exc):
            logger.warning("Finnhub earnings lookup unauthorized; disabling Finnhub earnings lookups for this batch")
            return _AUTH_FAILED
        logger.debug("Finnhub earnings lookup failed for %s: %s", ticker, exc)
        return _UNAVAILABLE

    if not items:
        return _UNAVAILABLE

    for item in items:
        raw_date = item.get("date") or ""
        try:
            earnings_date = dt.date.fromisoformat(raw_date)
        except ValueError:
            continue
        if earnings_date >= asof_date:
            return (earnings_date - asof_date).days

    return None


def _fetch_via_yfinance(ticker: str, asof_date: dt.date) -> int | None:
    try:
        info = yf.Ticker(ticker).calendar or {}
        dates = info.get("Earnings Date") or []
        if not isinstance(dates, list):
            dates = [dates]
        for raw in dates:
            try:
                earnings_date = raw.date() if hasattr(raw, "date") else dt.date.fromisoformat(str(raw)[:10])
            except Exception:
                continue
            if earnings_date >= asof_date:
                return (earnings_date - asof_date).days
    except Exception as exc:
        logger.debug("yfinance earnings lookup failed for %s: %s", ticker, exc)
    return None


def fetch_next_earnings_days(
    tickers: list[str],
    finnhub_api_key: str | None,
    asof_date: dt.date,
    max_workers: int = 4,
) -> dict[str, int | None]:
    """Return ticker to days until next earnings, or None when unknown."""
    result: dict[str, int | None] = {}
    finnhub_auth_failed = threading.Event()

    def _fetch_one(ticker: str) -> tuple[str, int | None]:
        if finnhub_api_key and not finnhub_auth_failed.is_set():
            days = _fetch_via_finnhub(ticker, finnhub_api_key, asof_date)
            if days is _AUTH_FAILED:
                finnhub_auth_failed.set()
                days = _fetch_via_yfinance(ticker, asof_date)
            if days is _UNAVAILABLE:
                days = _fetch_via_yfinance(ticker, asof_date)
        else:
            days = _fetch_via_yfinance(ticker, asof_date)
        return ticker, days if isinstance(days, int) else None

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_fetch_one, ticker): ticker for ticker in tickers}
        for future in as_completed(futures):
            try:
                ticker, days = future.result()
                result[ticker] = days
            except Exception as exc:
                result[futures[future]] = None
                logger.debug("Earnings proximity fetch failed: %s", exc)

    return result
