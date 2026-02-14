from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

import pandas as pd

from swing_screener.social.cache import SocialCache
from swing_screener.social.config import (
    DEFAULT_ATTENTION_LOOKBACK_DAYS,
    DEFAULT_SUBREDDITS,
    DEFAULT_USER_AGENT,
    DEFAULT_RATE_LIMIT_PER_SEC,
)
from swing_screener.social.metrics import compute_daily_metrics
from swing_screener.social.overlay import REASON_LOW_SAMPLE
from swing_screener.social.providers.reddit import RedditProvider
from swing_screener.data.providers.factory import get_market_data_provider


def _provider_for(name: str, cache: SocialCache):
    if name == "reddit":
        return RedditProvider(
            list(DEFAULT_SUBREDDITS),
            DEFAULT_USER_AGENT,
            DEFAULT_RATE_LIMIT_PER_SEC,
            cache,
        )
    raise ValueError(f"Unsupported social provider: {name}")


def analyze_social_symbol(
    symbol: str,
    *,
    lookback_hours: int,
    min_sample_size: int,
    provider_name: str = "reddit",
    max_events: int = 100,
    cache: Optional[SocialCache] = None,
) -> dict:
    cache = cache or SocialCache()
    symbol = str(symbol).strip().upper()
    if not symbol:
        return {
            "status": "error",
            "symbol": "",
            "provider": provider_name,
            "lookback_hours": lookback_hours,
            "last_execution_at": datetime.utcnow().replace(microsecond=0).isoformat(),
            "sample_size": 0,
            "sentiment_score": None,
            "sentiment_confidence": None,
            "attention_score": 0.0,
            "attention_z": None,
            "hype_score": None,
            "reasons": [],
            "raw_events": [],
            "error": "symbol is required",
        }

    lookback_hours = max(1, int(lookback_hours))
    max_events = max(1, int(max_events))

    now = datetime.utcnow().replace(microsecond=0)
    start_dt = now - timedelta(hours=lookback_hours)

    try:
        provider = _provider_for(provider_name, cache)
        events = provider.fetch_events(start_dt, now, [symbol])
        events_sorted = sorted(events, key=lambda e: e.timestamp, reverse=True)
        raw_events = events_sorted[:max_events]

        # Fetch minimal OHLCV data for hype_score calculation
        ohlcv = pd.DataFrame()
        try:
            # Fetch last 30 days of data for 20-day ADV calculation
            thirty_days_ago = now - timedelta(days=30)
            provider = get_market_data_provider()
            ohlcv = provider.fetch_ohlcv(
                [symbol],
                start_date=thirty_days_ago.strftime("%Y-%m-%d"),
                end_date=now.strftime("%Y-%m-%d"),
                use_cache=True,
                allow_cache_fallback_on_error=True,
            )
        except Exception:
            # If OHLCV fetch fails, hype_score will be None
            pass

        metrics = compute_daily_metrics(
            events,
            [symbol],
            ohlcv,
            now.date(),
            cache,
            z_lookback_days=DEFAULT_ATTENTION_LOOKBACK_DAYS,
        )
        metric = metrics[0]
        reasons: list[str] = []
        if metric.sample_size < min_sample_size:
            reasons.append(REASON_LOW_SAMPLE)
            status = "no_data"
        else:
            status = "ok"

        cache.update_symbol_run(
            provider.name,
            symbol,
            {
                "last_execution_at": now.isoformat(),
                "status": status,
                "sample_size": metric.sample_size,
                "lookback_hours": lookback_hours,
            },
        )

        return {
            "status": status,
            "symbol": symbol,
            "provider": provider.name,
            "lookback_hours": lookback_hours,
            "last_execution_at": now.isoformat(),
            "sample_size": metric.sample_size,
            "sentiment_score": metric.sentiment_score,
            "sentiment_confidence": metric.sentiment_confidence,
            "attention_score": metric.attention_score,
            "attention_z": metric.attention_z,
            "hype_score": metric.hype_score,
            "reasons": reasons,
            "raw_events": raw_events,
        }
    except Exception as exc:
        cache.update_symbol_run(
            provider_name,
            symbol,
            {
                "last_execution_at": now.isoformat(),
                "status": "error",
                "error": str(exc),
                "lookback_hours": lookback_hours,
            },
        )
        return {
            "status": "error",
            "symbol": symbol,
            "provider": provider_name,
            "lookback_hours": lookback_hours,
            "last_execution_at": now.isoformat(),
            "sample_size": 0,
            "sentiment_score": None,
            "sentiment_confidence": None,
            "attention_score": 0.0,
            "attention_z": None,
            "hype_score": None,
            "reasons": [],
            "raw_events": [],
            "error": str(exc),
        }
