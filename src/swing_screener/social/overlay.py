from __future__ import annotations

import math
from typing import Iterable

from swing_screener.social.models import SocialDailyMetrics, SocialOverlayDecision
from swing_screener.social.config import (
    SocialOverlayConfig,
    DEFAULT_HYPE_LOOKBACK_DAYS,
    DEFAULT_HYPE_FIXED_THRESHOLD,
)
from swing_screener.social.cache import SocialCache

REASON_ATTENTION_SPIKE = "ATTENTION_SPIKE"
REASON_HYPE_CROWDING = "HYPE_CROWDING"
REASON_NEG_SENT = "NEG_SENTIMENT_RISK"
REASON_LOW_SAMPLE = "LOW_SAMPLE_SIZE_NO_ACTION"


def _percentile(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    if percentile <= 0:
        return min(values)
    if percentile >= 100:
        return max(values)
    ordered = sorted(values)
    k = (len(ordered) - 1) * (percentile / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return ordered[int(k)]
    return ordered[f] + (ordered[c] - ordered[f]) * (k - f)


def _resolve_hype_threshold(
    cache: SocialCache,
    symbol: str,
    asof,
    percentile: float,
) -> float:
    history = cache.get_hype_history(symbol, asof, DEFAULT_HYPE_LOOKBACK_DAYS)
    if history and len(history) >= 20:
        value = _percentile(history, percentile)
        if value is not None:
            return float(value)
    return DEFAULT_HYPE_FIXED_THRESHOLD


def apply_overlay(
    metrics: Iterable[SocialDailyMetrics],
    cfg: SocialOverlayConfig,
    cache: SocialCache,
) -> list[SocialOverlayDecision]:
    out: list[SocialOverlayDecision] = []

    for m in metrics:
        d = SocialOverlayDecision(symbol=m.symbol, date=m.date)
        if m.sample_size < cfg.min_sample_size:
            d.reasons.append(REASON_LOW_SAMPLE)
            out.append(d)
            continue

        if m.attention_z is not None and m.attention_z >= cfg.attention_z_threshold:
            d.risk_multiplier = min(d.risk_multiplier, 0.5)
            d.max_pos_multiplier = min(d.max_pos_multiplier, 0.75)
            d.reasons.append(REASON_ATTENTION_SPIKE)

        if m.hype_score is not None:
            threshold = _resolve_hype_threshold(cache, m.symbol, m.date, cfg.hype_percentile_threshold)
            if m.hype_score >= threshold:
                d.max_pos_multiplier = min(d.max_pos_multiplier, 0.5)
                d.review_required = True
                d.reasons.append(REASON_HYPE_CROWDING)

        if (
            m.sentiment_score <= cfg.negative_sent_threshold
            and m.sentiment_confidence >= cfg.sentiment_conf_threshold
        ):
            d.review_required = True
            d.reasons.append(REASON_NEG_SENT)

        out.append(d)

    return out
