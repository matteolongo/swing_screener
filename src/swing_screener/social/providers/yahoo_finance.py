"""Yahoo Finance news provider."""
from __future__ import annotations

import time
from datetime import datetime, date
from typing import Optional

import httpx

from swing_screener.social.models import SocialRawEvent
from swing_screener.social.cache import SocialCache
from swing_screener.social.config import DEFAULT_CACHE_TTL_HOURS


class YahooFinanceProvider:
    """Yahoo Finance news provider.
    
    Fetches news headlines and summaries from Yahoo Finance.
    Uses the unofficial Yahoo Finance API (query1.finance.yahoo.com).
    """
    
    name = "yahoo_finance"
    
    def __init__(
        self,
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
        target_day: date = start_dt.date()
        cached = self.cache.get_events(
            self.name,
            target_day,
            symbols,
            max_age_hours=DEFAULT_CACHE_TTL_HOURS,
        )
        if cached is not None:
            return cached
        
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
                            dt = datetime.fromtimestamp(timestamp).replace(tzinfo=None)
                        else:
                            dt = datetime.utcnow()
                        
                        # Ensure timezone-naive comparison
                        start_naive = start_dt.replace(tzinfo=None) if start_dt.tzinfo else start_dt
                        end_naive = end_dt.replace(tzinfo=None) if end_dt.tzinfo else end_dt
                        
                        # Filter by date range
                        if not (start_naive <= dt <= end_naive):
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
                    print(f"Warning: Failed to fetch Yahoo Finance news for {symbol}: {e}")
                    continue
        
        # Cache the results
        self.cache.store_events(self.name, target_day, events)
        return events
