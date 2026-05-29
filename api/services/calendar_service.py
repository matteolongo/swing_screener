# api/services/calendar_service.py
from __future__ import annotations

import datetime as dt
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

import httpx

from api.models.calendar import CalendarEvent
from api.repositories.positions_repo import PositionsRepository

logger = logging.getLogger(__name__)

FINNHUB_EARNINGS_URL = "https://finnhub.io/api/v1/calendar/earnings"
FINNHUB_ECONOMIC_URL = "https://finnhub.io/api/v1/calendar/economic"
FINNHUB_IPO_URL = "https://finnhub.io/api/v1/calendar/ipo"
FINNHUB_DIVIDEND_URL = "https://finnhub.io/api/v1/calendar/dividend"


class CalendarService:
    def __init__(
        self,
        positions_repo: PositionsRepository,
        data_dir: Path,
        finnhub_api_key: Optional[str] = None,
    ):
        self._positions_repo = positions_repo
        self._data_dir = data_dir
        self._finnhub_api_key = finnhub_api_key

    def get_events(self, days_ahead: int = 30) -> list[CalendarEvent]:
        today = dt.date.today()
        end = today + dt.timedelta(days=days_ahead)

        position_tickers = self._get_position_tickers()
        screener_tickers = self._get_screener_tickers()
        all_tickers = position_tickers | screener_tickers

        events: list[CalendarEvent] = []
        events.extend(self._batch_fetch_earnings(all_tickers, position_tickers, today, end))
        events.extend(self._fetch_economic_events(today, end))
        events.extend(self._fetch_ipo_events(today, end))
        events.extend(self._fetch_dividend_events(position_tickers, today, end))

        return sorted(events, key=lambda e: e.date)

    def _get_position_tickers(self) -> set[str]:
        positions, _ = self._positions_repo.list_positions(status="open")
        return {p["ticker"] for p in positions if p.get("ticker")}

    def _get_screener_tickers(self) -> set[str]:
        reviews_dir = self._data_dir / "daily_reviews"
        if not reviews_dir.exists():
            return set()
        files = sorted(reviews_dir.glob("daily_review_*_default.json"))
        if not files:
            return set()
        latest = files[-1]
        try:
            data = json.loads(latest.read_text())
            candidates = data.get("new_candidates", []) + data.get("positions_add_on_candidates", [])
            return {c["ticker"] for c in candidates if c.get("ticker")}
        except Exception as exc:
            logger.debug("Could not read latest daily review: %s", exc)
            return set()

    def _batch_fetch_earnings(
        self,
        all_tickers: set[str],
        position_tickers: set[str],
        start: dt.date,
        end: dt.date,
    ) -> list[CalendarEvent]:
        if self._finnhub_api_key:
            return self._batch_fetch_earnings_finnhub(all_tickers, position_tickers, start, end)
        return self._batch_fetch_earnings_yfinance(all_tickers, position_tickers, start, end)

    def _batch_fetch_earnings_finnhub(
        self,
        all_tickers: set[str],
        position_tickers: set[str],
        start: dt.date,
        end: dt.date,
    ) -> list[CalendarEvent]:
        events: list[CalendarEvent] = []
        try:
            with ThreadPoolExecutor(max_workers=12) as pool:
                futures = {
                    pool.submit(self._fetch_earnings_for_finnhub, t, start, end): t
                    for t in all_tickers
                }
                for future in as_completed(futures):
                    ticker = futures[future]
                    try:
                        result = future.result()
                        if result is None:
                            continue
                        earnings_date, eps_estimate, eps_actual = result
                        source_tag = "position" if ticker in position_tickers else "screener"
                        events.append(CalendarEvent(
                            date=earnings_date.isoformat(),
                            ticker=ticker,
                            event_type="earnings",
                            title=f"{ticker} Earnings",
                            source_tag=source_tag,
                            provider="finnhub",
                            confidence=0.85,
                            source_url=FINNHUB_EARNINGS_URL,
                            eps_estimate=eps_estimate,
                            eps_actual=eps_actual,
                        ))
                    except Exception as exc:
                        logger.debug("Finnhub earnings failed for %s: %s", ticker, exc)
        except Exception as exc:
            logger.info("Finnhub earnings batch failed, falling back to yfinance: %s", exc)
            return self._batch_fetch_earnings_yfinance(all_tickers, position_tickers, start, end)
        return events

    def _fetch_earnings_for_finnhub(
        self,
        ticker: str,
        start: dt.date,
        end: dt.date,
    ) -> Optional[tuple[dt.date, Optional[float], Optional[float]]]:
        resp = httpx.get(
            FINNHUB_EARNINGS_URL,
            params={
                "symbol": ticker,
                "from": start.isoformat(),
                "to": end.isoformat(),
                "token": self._finnhub_api_key,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        items = resp.json().get("earningsCalendar", [])
        today = dt.date.today()
        upcoming = [
            item for item in items
            if item.get("date") and (d := _parse_date(item["date"])) is not None
            and d >= today
        ]
        if not upcoming:
            return None
        item = upcoming[0]
        earnings_date = _parse_date(item["date"])
        eps_estimate = _safe_float(item.get("epsEstimate"))
        eps_actual = _safe_float(item.get("epsActual"))
        return earnings_date, eps_estimate, eps_actual

    def _batch_fetch_earnings_yfinance(
        self,
        all_tickers: set[str],
        position_tickers: set[str],
        start: dt.date,
        end: dt.date,
    ) -> list[CalendarEvent]:
        events: list[CalendarEvent] = []
        with ThreadPoolExecutor(max_workers=12) as pool:
            futures = {pool.submit(self._fetch_earnings_for, t): t for t in all_tickers}
            for future in as_completed(futures):
                ticker = futures[future]
                try:
                    earnings_date = future.result()
                    if earnings_date and start <= earnings_date <= end:
                        source_tag = "position" if ticker in position_tickers else "screener"
                        events.append(CalendarEvent(
                            date=earnings_date.isoformat(),
                            ticker=ticker,
                            event_type="earnings",
                            title=f"{ticker} Earnings",
                            source_tag=source_tag,
                            provider="yfinance",
                            confidence=0.55,
                            source_url=f"https://finance.yahoo.com/quote/{ticker}/calendar",
                        ))
                except Exception as exc:
                    logger.debug("Earnings fetch failed for %s: %s", ticker, exc)
        return events

    def _fetch_earnings_for(self, ticker: str) -> Optional[dt.date]:
        import yfinance

        today = dt.date.today()
        calendar = yfinance.Ticker(ticker).calendar or {}
        earnings_dates = calendar.get("Earnings Date", [])
        if not isinstance(earnings_dates, list):
            earnings_dates = [earnings_dates]
        upcoming = sorted(
            parsed
            for raw in earnings_dates
            if (parsed := _parse_date(raw)) is not None and parsed >= today
        )
        return upcoming[0] if upcoming else None

    def _fetch_economic_events(self, start: dt.date, end: dt.date) -> list[CalendarEvent]:
        if not self._finnhub_api_key:
            return []
        try:
            resp = httpx.get(
                FINNHUB_ECONOMIC_URL,
                params={
                    "from": start.isoformat(),
                    "to": end.isoformat(),
                    "token": self._finnhub_api_key,
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            items = resp.json().get("economicCalendar", [])
            return [
                CalendarEvent(
                    date=item["time"][:10],
                    ticker=None,
                    event_type="economic",
                    title=item.get("event", "Economic event"),
                    source_tag="economic",
                    provider="finnhub",
                    confidence=0.8,
                    source_url=FINNHUB_ECONOMIC_URL,
                )
                for item in items
                if item.get("time") and item.get("impact") == "high"
            ]
        except Exception as exc:
            logger.info("Economic events fetch skipped: %s", exc)
            return []

    def _fetch_ipo_events(self, start: dt.date, end: dt.date) -> list[CalendarEvent]:
        if not self._finnhub_api_key:
            return []
        try:
            resp = httpx.get(
                FINNHUB_IPO_URL,
                params={
                    "from": start.isoformat(),
                    "to": end.isoformat(),
                    "token": self._finnhub_api_key,
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            items = resp.json().get("ipoCalendar", [])
            return [
                CalendarEvent(
                    date=item["date"],
                    ticker=item.get("symbol"),
                    event_type="ipo",
                    title=f"{item.get('name', item.get('symbol', 'IPO'))} IPO",
                    source_tag="ipo",
                    provider="finnhub",
                    confidence=0.8,
                    source_url=FINNHUB_IPO_URL,
                )
                for item in items
                if item.get("date") and item.get("status") in {"priced", "filed"}
            ]
        except Exception as exc:
            logger.info("IPO calendar fetch skipped: %s", exc)
            return []

    def _fetch_dividend_events(
        self,
        position_tickers: set[str],
        start: dt.date,
        end: dt.date,
    ) -> list[CalendarEvent]:
        if not self._finnhub_api_key or not position_tickers:
            return []
        events: list[CalendarEvent] = []
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {
                pool.submit(self._fetch_dividends_for, t, start, end): t
                for t in position_tickers
            }
            for future in as_completed(futures):
                ticker = futures[future]
                try:
                    events.extend(future.result())
                except Exception as exc:
                    logger.debug("Dividend fetch failed for %s: %s", ticker, exc)
        return events

    def _fetch_dividends_for(
        self,
        ticker: str,
        start: dt.date,
        end: dt.date,
    ) -> list[CalendarEvent]:
        resp = httpx.get(
            FINNHUB_DIVIDEND_URL,
            params={
                "symbol": ticker,
                "from": start.isoformat(),
                "to": end.isoformat(),
                "token": self._finnhub_api_key,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        items = resp.json().get("dividendCalendar", [])
        return [
            CalendarEvent(
                date=item["date"],
                ticker=ticker,
                event_type="dividend",
                title=f"{ticker} Dividend",
                source_tag="position",
                provider="finnhub",
                confidence=0.8,
                source_url=FINNHUB_DIVIDEND_URL,
            )
            for item in items
            if item.get("date")
        ]


def _safe_float(value: object) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_date(raw: object) -> Optional[dt.date]:
    try:
        import pandas as pd

        if isinstance(raw, pd.Timestamp):
            return raw.date()
        if isinstance(raw, dt.date):
            return raw
        return dt.date.fromisoformat(str(raw)[:10])
    except Exception:
        return None
