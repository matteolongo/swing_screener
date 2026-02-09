from __future__ import annotations

from datetime import date, datetime, time
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
) -> tuple[list[SocialDailyMetrics], list[SocialOverlayDecision]]:
    cache = SocialCache()
    provider = RedditProvider(
        list(DEFAULT_SUBREDDITS),
        DEFAULT_USER_AGENT,
        DEFAULT_RATE_LIMIT_PER_SEC,
        cache,
    )

    start_dt = datetime.combine(asof, time.min)
    end_dt = datetime.combine(asof, time.max)

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

    return metrics, decisions


__all__ = [
    "run_social_overlay",
    "SocialOverlayConfig",
    "SocialDailyMetrics",
    "SocialOverlayDecision",
]
