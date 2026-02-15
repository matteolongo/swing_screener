from __future__ import annotations

import hashlib
import logging
from datetime import UTC, datetime
from typing import Any, Callable

import pandas as pd
import yfinance as yf

from swing_screener.intelligence.models import Event

logger = logging.getLogger(__name__)

EarningsFetcher = Callable[[str], dict[str, Any] | None]


def _to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def _build_event_id(*parts: str) -> str:
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]
    return f"ec-{digest}"


def _coerce_dt(raw: Any) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return _to_utc_naive(raw)
    if isinstance(raw, pd.Timestamp):
        if pd.isna(raw):
            return None
        return _to_utc_naive(raw.to_pydatetime())
    if isinstance(raw, (list, tuple)):
        for item in raw:
            dt = _coerce_dt(item)
            if dt is not None:
                return dt
        return None
    text = str(raw).strip()
    if not text:
        return None
    try:
        return _to_utc_naive(datetime.fromisoformat(text.replace("Z", "+00:00")))
    except ValueError:
        return None


class EarningsCalendarEventProvider:
    name = "earnings_calendar"

    def __init__(self, fetcher: EarningsFetcher | None = None) -> None:
        self._fetcher = fetcher or self._default_fetcher

    def _default_fetcher(self, symbol: str) -> dict[str, Any] | None:
        ticker = yf.Ticker(symbol)
        calendar = ticker.calendar
        if calendar is None:
            return None

        earnings_date: datetime | None = None
        eps_estimate: float | None = None

        if isinstance(calendar, pd.DataFrame):
            if "Earnings Date" in calendar.index:
                earnings_date = _coerce_dt(calendar.loc["Earnings Date"].iloc[0])
            if "EPS Estimate" in calendar.index:
                try:
                    eps_estimate = float(calendar.loc["EPS Estimate"].iloc[0])
                except (TypeError, ValueError):
                    eps_estimate = None
        elif isinstance(calendar, dict):
            earnings_date = _coerce_dt(
                calendar.get("Earnings Date")
                or calendar.get("earningsDate")
                or calendar.get("earnings_date")
            )
            try:
                eps_estimate = float(
                    calendar.get("EPS Estimate")
                    or calendar.get("epsEstimate")
                    or calendar.get("eps_estimate")
                )
            except (TypeError, ValueError):
                eps_estimate = None

        if earnings_date is None:
            return None
        return {"earnings_date": earnings_date.isoformat(), "eps_estimate": eps_estimate}

    def fetch_events(
        self,
        *,
        symbols: list[str],
        start_dt: datetime,
        end_dt: datetime,
    ) -> list[Event]:
        start_utc = _to_utc_naive(start_dt)
        end_utc = _to_utc_naive(end_dt)
        events: list[Event] = []

        for raw_symbol in symbols:
            symbol = str(raw_symbol).strip().upper()
            if not symbol:
                continue

            try:
                payload = self._fetcher(symbol)
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.warning("EarningsCalendarEventProvider failed for %s: %s", symbol, exc)
                continue

            if not payload or not isinstance(payload, dict):
                continue
            earnings_date = _coerce_dt(payload.get("earnings_date"))
            if earnings_date is None:
                continue
            if not (start_utc <= earnings_date <= end_utc):
                continue

            event_id = _build_event_id(symbol, earnings_date.isoformat(), "earnings_calendar")
            eps_estimate = payload.get("eps_estimate")
            metadata: dict[str, str | float | int | bool] = {}
            if isinstance(eps_estimate, (int, float)):
                metadata["eps_estimate"] = float(eps_estimate)
            session = payload.get("session")
            if session is not None:
                metadata["session"] = str(session)

            events.append(
                Event(
                    event_id=event_id,
                    symbol=symbol,
                    source=self.name,
                    occurred_at=earnings_date.isoformat(),
                    headline=f"{symbol} earnings scheduled",
                    event_type="earnings_calendar",
                    credibility=0.8,
                    url=None,
                    metadata=metadata,
                )
            )

        events.sort(key=lambda ev: (ev.occurred_at, ev.event_id), reverse=True)
        return events

