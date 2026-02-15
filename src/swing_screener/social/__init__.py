from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Iterable

import pandas as pd

from swing_screener.social.cache import SocialCache
from swing_screener.social.config import (
    SocialOverlayConfig,
    DEFAULT_SUBREDDITS,
    DEFAULT_USER_AGENT,
    DEFAULT_RATE_LIMIT_PER_SEC,
    DEFAULT_ATTENTION_LOOKBACK_DAYS,
    DEFAULT_PROVIDERS,
)
from swing_screener.social.metrics import compute_daily_metrics
from swing_screener.social.overlay import apply_overlay
from swing_screener.social.providers import RedditProvider
from swing_screener.social.providers.yahoo_finance import YahooFinanceProvider
from swing_screener.social.models import SocialDailyMetrics, SocialOverlayDecision
from swing_screener.social.sentiment.factory import get_sentiment_analyzer


def _provider_for(name: str, cache: SocialCache):
    if name == "reddit":
        return RedditProvider(
            list(DEFAULT_SUBREDDITS),
            DEFAULT_USER_AGENT,
            DEFAULT_RATE_LIMIT_PER_SEC,
            cache,
        )
    if name == "yahoo_finance":
        return YahooFinanceProvider(
            DEFAULT_USER_AGENT,
            DEFAULT_RATE_LIMIT_PER_SEC,
            cache,
        )
    raise ValueError(f"Unsupported social provider: {name}")


def run_social_overlay(
    symbols: Iterable[str],
    ohlcv: pd.DataFrame,
    asof: date,
    cfg: SocialOverlayConfig,
) -> tuple[list[SocialDailyMetrics], list[SocialOverlayDecision], dict]:
    cache = SocialCache()
    provider_names = list(cfg.providers or tuple(DEFAULT_PROVIDERS))
    sentiment_analyzer = get_sentiment_analyzer(cfg.sentiment_analyzer)

    lookback_hours = max(1, int(cfg.lookback_hours))
    end_dt = datetime.combine(asof, time.max)
    start_dt = end_dt - timedelta(hours=lookback_hours)
    provider_label = provider_names[0] if len(provider_names) == 1 else "multiple"

    meta: dict = {
        "provider": provider_label,
        "providers": provider_names,
        "sentiment_analyzer": sentiment_analyzer.name,
        "asof": asof.isoformat(),
        "start_dt": start_dt.isoformat(),
        "end_dt": end_dt.isoformat(),
        "lookback_hours": lookback_hours,
        "status": "ok",
    }

    try:
        events = []
        for provider_name in provider_names:
            provider = _provider_for(provider_name, cache)
            events.extend(provider.fetch_events(start_dt, end_dt, list(symbols)))
        metrics = compute_daily_metrics(
            events,
            symbols,
            ohlcv,
            asof,
            cache,
            z_lookback_days=DEFAULT_ATTENTION_LOOKBACK_DAYS,
            sentiment_analyzer=sentiment_analyzer,
        )
        decisions = apply_overlay(metrics, cfg, cache)
        cache.update_run_metadata(meta)
        return metrics, decisions, meta
    except Exception as exc:
        meta["status"] = "error"
        meta["error"] = str(exc)
        cache.update_run_metadata(meta)
        raise


__all__ = [
    "run_social_overlay",
    "SocialOverlayConfig",
    "SocialDailyMetrics",
    "SocialOverlayDecision",
]
