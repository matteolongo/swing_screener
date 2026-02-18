"""Yahoo Finance news provider."""
from __future__ import annotations

import logging
import time
from datetime import datetime, date, timezone
from typing import Optional

import httpx

from swing_screener.social.models import SocialRawEvent
from swing_screener.social.cache import SocialCache
from swing_screener.social.config import DEFAULT_CACHE_TTL_HOURS

logger = logging.getLogger(__name__)

def _to_utc_naive(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class YahooFinanceProvider:
    """Yahoo Finance news provider.
    
    Fetches news headlines and summaries from Yahoo Finance.
    Uses the unofficial Yahoo Finance API (query1.finance.yahoo.com).
    """
    
    name = "yahoo_finance"
    
    def __init__(self,
        user_agent: str,
        rate_limit_per_sec: float,
        cache: SocialCache,
    ) -> None:
        self.user_agent = user_agent
        self.delay = 1.0 / max(rate_limit_per_sec, 0.1)
        self.cache = cache
    
    def fetch_events(
        self, start_dt: datetime, end_dt: datetime, symbols: list[str]
    ) -> list[SocialRawEvent]:
        """Fetch news events for symbols from Yahoo Finance."""
        start_utc = _to_utc_naive(start_dt)
        end_utc = _to_utc_naive(end_dt)
        target_day: date = end_utc.date()
        cached = self.cache.get_events(
            self.name,
            target_day,
            symbols,
            max_age_hours=DEFAULT_CACHE_TTL_HOURS,
        )
        if cached is not None:
            # Filter cached events to match the requested time range
            filtered = [
                event for event in cached
                if start_utc <= event.timestamp <= end_utc
            ]
            return filtered
        
        headers = {"User-Agent": self.user_agent}
        events: list[SocialRawEvent] = []
        
        with httpx.Client(timeout=20.0, headers=headers) as client:
            for symbol in symbols:
                symbol = str(symbol).upper().strip()
                if not symbol:
                    continue
                
                try:
                    # Yahoo Finance news API endpoint
                    url = f"https://query1.finance.yahoo.com/v1/finance/search"
                    params = {
                        "q": symbol,
                        "quotesCount": 0,
                        "newsCount": 10,
                        "enableFuzzyQuery": False,
                    }
                    
                    resp = client.get(url, params=params)
                    resp.raise_for_status()
                    data = resp.json()
                    
                    news_items = data.get("news", [])
                    for item in news_items:
                        title = item.get("title", "")
                        summary = item.get("summary", "")
                        text = f"{title}. {summary}".strip()
                        
                        if not text:
                            continue
                        
                        # Parse timestamp (Unix timestamp in seconds)
                        timestamp = item.get("providerPublishTime")
                        if timestamp:
                            dt = datetime.fromtimestamp(timestamp, tz=timezone.utc).replace(
                                tzinfo=None
                            )
                        else:
                            dt = datetime.now(timezone.utc).replace(tzinfo=None)

                        # Filter by date range
                        if not (start_utc <= dt <= end_utc):
                            continue
                        
                        events.append(
                            SocialRawEvent(
                                source=self.name,
                                symbol=symbol,
                                timestamp=dt,
                                text=text,
                                author_id_hash=item.get("publisher", None),
                                upvotes=None,
                                url=item.get("link", None),
                                metadata={
                                    "type": item.get("type", "news"),
                                    "publisher": item.get("publisher", ""),
                                },
                            )
                        )
                    
                    # Rate limiting
                    time.sleep(self.delay)
                    
                except (httpx.HTTPError, KeyError, ValueError) as e:
                    # Log error but continue with other symbols
                    logger.warning(
                        "Failed to fetch Yahoo Finance news for %s: %s", symbol, e
                    )
                    continue
        
        # Cache the results
        self.cache.store_events(self.name, target_day, events)
        return events
