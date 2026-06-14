"""Deterministic candlestick pattern detection.

Pure functions: OHLCV in, patterns out. No state, no I/O. Thresholds come from
config (low_level.candles). Patterns are advisory and contextual — they never
feed the ranking/setup score.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from swing_screener.selection.entries import breakout_signal, pullback_reclaim_signal
from swing_screener.settings.manager import get_settings_manager


def _candle_defaults() -> dict:
    d = get_settings_manager().get_low_level_defaults_payload("candles")
    return d if isinstance(d, dict) else {}


@dataclass(frozen=True)
class CandleConfig:
    lookback: int = field(
        default_factory=lambda: int(_candle_defaults().get("lookback", 10))
    )
    doji_body_ratio: float = field(
        default_factory=lambda: float(_candle_defaults().get("doji_body_ratio", 0.1))
    )
    hammer_lower_wick_mult: float = field(
        default_factory=lambda: float(
            _candle_defaults().get("hammer_lower_wick_mult", 2.0)
        )
    )
    hammer_max_opposite_wick_ratio: float = field(
        default_factory=lambda: float(
            _candle_defaults().get("hammer_max_opposite_wick_ratio", 0.25)
        )
    )
    extension_threshold_pct: float = field(
        default_factory=lambda: float(
            _candle_defaults().get("extension_threshold_pct", 0.10)
        )
    )
    breakout_lookback: int = field(
        default_factory=lambda: int(_candle_defaults().get("breakout_lookback", 50))
    )
    pullback_ma: int = field(
        default_factory=lambda: int(_candle_defaults().get("pullback_ma", 20))
    )


@dataclass(frozen=True)
class _Metrics:
    o: float
    h: float
    low: float
    c: float
    body: float
    rng: float
    upper_wick: float
    lower_wick: float


def _bar_metrics(o: float, h: float, low: float, c: float) -> _Metrics:
    body = abs(c - o)
    rng = h - low
    upper_wick = h - max(o, c)
    lower_wick = min(o, c) - low
    return _Metrics(
        o=o,
        h=h,
        low=low,
        c=c,
        body=body,
        rng=rng,
        upper_wick=upper_wick,
        lower_wick=lower_wick,
    )


def _is_doji(m: _Metrics, cfg: CandleConfig) -> bool:
    if m.rng <= 0:
        return False
    body_ratio = m.body / m.rng
    return body_ratio <= cfg.doji_body_ratio


def _is_hammer(m: _Metrics, cfg: CandleConfig) -> bool:
    if m.rng <= 0 or m.body <= 0:
        return False
    return (
        m.lower_wick >= cfg.hammer_lower_wick_mult * m.body
        and m.upper_wick <= cfg.hammer_max_opposite_wick_ratio * m.rng
    )


def _is_shooting_star(m: _Metrics, cfg: CandleConfig) -> bool:
    if m.rng <= 0 or m.body <= 0:
        return False
    return (
        m.upper_wick >= cfg.hammer_lower_wick_mult * m.body
        and m.lower_wick <= cfg.hammer_max_opposite_wick_ratio * m.rng
    )


def _is_bullish_engulfing(prev: _Metrics, cur: _Metrics) -> bool:
    prev_bearish = prev.c < prev.o
    cur_bullish = cur.c > cur.o
    return prev_bearish and cur_bullish and cur.c >= prev.o and cur.o <= prev.c


def _is_bearish_engulfing(prev: _Metrics, cur: _Metrics) -> bool:
    prev_bullish = prev.c > prev.o
    cur_bearish = cur.c < cur.o
    return prev_bullish and cur_bearish and cur.o >= prev.c and cur.c <= prev.o


def _is_inside_bar(prev: _Metrics, cur: _Metrics) -> bool:
    return cur.h < prev.h and cur.low > prev.low


def _is_outside_bar(prev: _Metrics, cur: _Metrics) -> bool:
    return cur.h > prev.h and cur.low < prev.low


def _context_for_latest(close_s: pd.Series, cfg: CandleConfig) -> str:
    """Label the latest bar's setup context. Precedence: extended > at_breakout
    > at_pullback > none. 'extended' suppresses pattern-based stops downstream."""
    close_s = close_s.dropna()
    if len(close_s) < cfg.breakout_lookback + 2:
        return "none"

    last = float(close_s.iloc[-1])
    prior_high = float(close_s.iloc[-(cfg.breakout_lookback + 1) : -1].max())
    if prior_high > 0 and (last / prior_high) - 1.0 >= cfg.extension_threshold_pct:
        return "extended"

    is_breakout, _ = breakout_signal(close_s, cfg.breakout_lookback)
    if is_breakout:
        return "at_breakout"

    is_pullback, _ = pullback_reclaim_signal(close_s, cfg.pullback_ma)
    if is_pullback:
        return "at_pullback"

    return "none"
