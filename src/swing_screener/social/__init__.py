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
)
from swing_screener.social.metrics import compute_daily_metrics
from swing_screener.social.overlay import apply_overlay
from swing_screener.social.providers import RedditProvider
from swing_screener.social.models import SocialDailyMetrics, SocialOverlayDecision


def run_social_overlay(
    symbols: Iterable[str],
    ohlcv: pd.DataFrame,
    asof: date,
    cfg: SocialOverlayConfig,
) -> tuple[list[SocialDailyMetrics], list[SocialOverlayDecision], dict]:
    cache = SocialCache()
    provider = RedditProvider(
        list(DEFAULT_SUBREDDITS),
        DEFAULT_USER_AGENT,
        DEFAULT_RATE_LIMIT_PER_SEC,
        cache,
    )

    lookback_hours = max(1, int(cfg.lookback_hours))
    end_dt = datetime.combine(asof, time.max)
    start_dt = end_dt - timedelta(hours=lookback_hours)

    meta: dict = {
        "provider": provider.name,
        "asof": asof.isoformat(),
        "start_dt": start_dt.isoformat(),
        "end_dt": end_dt.isoformat(),
        "lookback_hours": lookback_hours,
        "status": "ok",
    }

    try:
        events = provider.fetch_events(start_dt, end_dt, list(symbols))
        metrics = compute_daily_metrics(
            events,
            symbols,
            ohlcv,
            asof,
            cache,
            z_lookback_days=DEFAULT_ATTENTION_LOOKBACK_DAYS,
        )
        decisions = apply_overlay(metrics, cfg, cache)
        cache.store_run_metadata(meta)
        return metrics, decisions, meta
    except Exception as exc:
        meta["status"] = "error"
        meta["error"] = str(exc)
        cache.store_run_metadata(meta)
        raise


__all__ = [
    "run_social_overlay",
    "SocialOverlayConfig",
    "SocialDailyMetrics",
    "SocialOverlayDecision",
]
