from __future__ import annotations

from datetime import date
import math
from typing import Iterable

import pandas as pd

from swing_screener.social.models import SocialRawEvent, SocialDailyMetrics
from swing_screener.social.cache import SocialCache
from swing_screener.social.utils import sentiment_score_event


def compute_daily_metrics(
    events: list[SocialRawEvent],
    symbols: Iterable[str],
    ohlcv: pd.DataFrame,
    asof: date,
    cache: SocialCache,
    z_lookback_days: int = 60,
) -> list[SocialDailyMetrics]:
    symbol_set = {str(s).upper() for s in symbols}
    by_symbol: dict[str, list[SocialRawEvent]] = {s: [] for s in symbol_set}
    for ev in events:
        sym = ev.symbol.upper()
        if sym in symbol_set:
            by_symbol.setdefault(sym, []).append(ev)

    metrics: list[SocialDailyMetrics] = []
    for symbol in sorted(symbol_set):
        evs = by_symbol.get(symbol, [])
        sample_size = len(evs)
        attention_score = float(sample_size)

        sent_vals = [sentiment_score_event(ev.text) for ev in evs]
        sent_score = float(sum(sent_vals) / max(len(sent_vals), 1))
        sent_conf = min(1.0, abs(sent_score) * math.sqrt(sample_size) / 3.0)

        prior = cache.get_attention_history(symbol, asof, z_lookback_days)
        att_z = None
        if prior and len(prior) >= 20:
            mean = sum(prior) / len(prior)
            var = sum((x - mean) ** 2 for x in prior) / max(len(prior) - 1, 1)
            std = math.sqrt(var)
            if std > 0:
                att_z = (attention_score - mean) / std

        hype_score = None
        vol_key = ("Volume", symbol)
        if vol_key in ohlcv.columns:
            adv = ohlcv[vol_key].rolling(20).mean().iloc[-1]
            if pd.notna(adv) and adv and adv > 0:
                hype_score = (attention_score / float(adv)) * 1_000_000.0

        metrics.append(
            SocialDailyMetrics(
                symbol=symbol,
                date=asof,
                attention_score=attention_score,
                attention_z=att_z,
                sentiment_score=sent_score,
                sentiment_confidence=sent_conf,
                hype_score=hype_score,
                sample_size=sample_size,
                source_breakdown={"reddit": sample_size},
            )
        )

    # Merge with existing metrics to avoid overwriting data for other symbols
    existing_metrics = cache.get_metrics(asof) or []
    existing_by_symbol = {m.symbol.upper(): m for m in existing_metrics}
    
    # Update with newly computed metrics
    for m in metrics:
        existing_by_symbol[m.symbol.upper()] = m
    
    # Store merged metrics
    merged_metrics = list(existing_by_symbol.values())
    cache.store_metrics(asof, merged_metrics)
    return metrics
