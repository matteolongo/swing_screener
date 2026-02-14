from __future__ import annotations

from datetime import date
import math
from typing import Iterable, Optional

import pandas as pd

from swing_screener.social.models import SocialRawEvent, SocialDailyMetrics
from swing_screener.social.cache import SocialCache
from swing_screener.social.sentiment.base import SentimentAnalyzer
from swing_screener.social.sentiment.factory import get_sentiment_analyzer


def compute_daily_metrics(
    events: list[SocialRawEvent],
    symbols: Iterable[str],
    ohlcv: pd.DataFrame,
    asof: date,
    cache: SocialCache,
    z_lookback_days: int = 60,
    sentiment_analyzer: Optional[SentimentAnalyzer] = None,
) -> list[SocialDailyMetrics]:
    """Compute daily social metrics for symbols.
    
    Args:
        events: Raw social events
        symbols: Symbols to compute metrics for
        ohlcv: Market data for hype score calculation
        asof: Date to compute metrics for
        cache: Cache for storing/retrieving metrics
        z_lookback_days: Days to look back for attention z-score
        sentiment_analyzer: Optional sentiment analyzer (defaults to keyword)
    """
    if sentiment_analyzer is None:
        sentiment_analyzer = get_sentiment_analyzer("keyword")
    
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

        # Use pluggable sentiment analyzer
        sent_results = [sentiment_analyzer.analyze(ev.text) for ev in evs]
        if sent_results:
            sent_score = float(sum(r.score for r in sent_results) / len(sent_results))
            sent_conf = float(sum(r.confidence for r in sent_results) / len(sent_results))
        else:
            sent_score = 0.0
            sent_conf = 0.0

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
        
        # Count events by source
        source_breakdown = {}
        for ev in evs:
            source_breakdown[ev.source] = source_breakdown.get(ev.source, 0) + 1

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
                source_breakdown=source_breakdown,
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
