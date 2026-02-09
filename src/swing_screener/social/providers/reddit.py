from __future__ import annotations

import time
from datetime import datetime, date

import httpx

from swing_screener.social.models import SocialRawEvent
from swing_screener.social.utils import extract_tickers, hash_author
from swing_screener.social.cache import SocialCache
from swing_screener.social.config import DEFAULT_CACHE_TTL_HOURS


class RedditProvider:
    name = "reddit"

    def __init__(
        self,
        subreddits: list[str],
        user_agent: str,
        rate_limit_per_sec: float,
        cache: SocialCache,
    ) -> None:
        self.subreddits = subreddits
        self.user_agent = user_agent
        self.delay = 1.0 / max(rate_limit_per_sec, 0.1)
        self.cache = cache

    def fetch_events(
        self, start_dt: datetime, end_dt: datetime, symbols: list[str]
    ) -> list[SocialRawEvent]:
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
        symbol_set = {str(s).upper() for s in symbols}

        with httpx.Client(timeout=20.0, headers=headers) as client:
            for sub in self.subreddits:
                url = f"https://www.reddit.com/r/{sub}/new.json?limit=100"
                resp = client.get(url)
                resp.raise_for_status()
                items = resp.json().get("data", {}).get("children", [])
                for item in items:
                    data = item.get("data", {})
                    ts = datetime.utcfromtimestamp(data.get("created_utc", 0))
                    if not (start_dt <= ts <= end_dt):
                        continue
                    text = f"{data.get('title','')} {data.get('selftext','')}"
                    matched = extract_tickers(text, symbol_set)
                    for sym in matched:
                        events.append(
                            SocialRawEvent(
                                source=self.name,
                                symbol=sym,
                                timestamp=ts,
                                text=text,
                                author_id_hash=hash_author(data.get("author")),
                                upvotes=data.get("score"),
                                url=f"https://www.reddit.com{data.get('permalink','')}",
                                metadata={"subreddit": sub, "id": data.get("id")},
                            )
                        )
                time.sleep(self.delay)

        self.cache.store_events(self.name, target_day, events)
        return events
