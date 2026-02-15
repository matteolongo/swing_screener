from __future__ import annotations

import hashlib
import logging
from datetime import UTC, datetime
from typing import Any, Callable

import httpx

from swing_screener.intelligence.models import Event

logger = logging.getLogger(__name__)

YahooNewsFetcher = Callable[[str], list[dict[str, Any]]]


def _to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def _parse_publish_time(item: dict[str, Any], fallback: datetime) -> datetime:
    ts = item.get("providerPublishTime")
    try:
        if ts is not None:
            return datetime.fromtimestamp(int(ts), tz=UTC).replace(tzinfo=None)
    except (TypeError, ValueError, OSError):
        pass
    return fallback


def _build_event_id(*parts: str) -> str:
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]
    return f"yf-{digest}"


class YahooFinanceEventProvider:
    name = "yahoo_finance"

    def __init__(
        self,
        *,
        user_agent: str = "swing-screener/1.0",
        timeout_sec: float = 20.0,
        max_news_per_symbol: int = 25,
        fetcher: YahooNewsFetcher | None = None,
    ) -> None:
        self._user_agent = user_agent
        self._timeout_sec = float(timeout_sec)
        self._max_news_per_symbol = max(1, int(max_news_per_symbol))
        self._fetcher = fetcher or self._default_fetcher

    def _default_fetcher(self, symbol: str) -> list[dict[str, Any]]:
        headers = {"User-Agent": self._user_agent}
        with httpx.Client(timeout=self._timeout_sec, headers=headers) as client:
            response = client.get(
                "https://query1.finance.yahoo.com/v1/finance/search",
                params={
                    "q": symbol,
                    "quotesCount": 0,
                    "newsCount": self._max_news_per_symbol,
                    "enableFuzzyQuery": False,
                },
            )
            response.raise_for_status()
            payload = response.json()
        news = payload.get("news", [])
        return news if isinstance(news, list) else []

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
                items = self._fetcher(symbol)
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.warning("YahooFinanceEventProvider failed for %s: %s", symbol, exc)
                continue

            for item in items:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title", "")).strip()
                summary = str(item.get("summary", "")).strip()
                text = ". ".join(part for part in [title, summary] if part).strip()
                if not text:
                    continue

                published_at = _parse_publish_time(item, fallback=end_utc)
                if not (start_utc <= published_at <= end_utc):
                    continue

                url = str(item.get("link", "")).strip() or None
                publisher = str(item.get("publisher", "")).strip()
                event_id = _build_event_id(symbol, published_at.isoformat(), url or title)

                events.append(
                    Event(
                        event_id=event_id,
                        symbol=symbol,
                        source=self.name,
                        occurred_at=published_at.isoformat(),
                        headline=title or text[:120],
                        event_type="news",
                        credibility=0.65,
                        url=url,
                        metadata={
                            "publisher": publisher,
                            "content_type": str(item.get("type", "news")),
                        },
                    )
                )

        events.sort(key=lambda ev: (ev.occurred_at, ev.event_id), reverse=True)
        return events

