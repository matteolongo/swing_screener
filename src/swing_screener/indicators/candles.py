"""Deterministic candlestick pattern detection.

Pure functions: OHLCV in, patterns out. No state, no I/O. Thresholds come from
config (low_level.candles). Patterns are advisory and contextual — they never
feed the ranking/setup score.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from swing_screener.settings.manager import get_settings_manager


def _candle_defaults() -> dict:
    d = get_settings_manager().get_low_level_defaults_payload("candles")
    return d if isinstance(d, dict) else {}


@dataclass(frozen=True)
class CandleConfig:
    lookback: int = field(default_factory=lambda: int(_candle_defaults().get("lookback", 10)))
    doji_body_ratio: float = field(default_factory=lambda: float(_candle_defaults().get("doji_body_ratio", 0.05)))
    hammer_lower_wick_mult: float = field(default_factory=lambda: float(_candle_defaults().get("hammer_lower_wick_mult", 2.0)))
    hammer_max_opposite_wick_ratio: float = field(default_factory=lambda: float(_candle_defaults().get("hammer_max_opposite_wick_ratio", 0.25)))
    extension_threshold_pct: float = field(default_factory=lambda: float(_candle_defaults().get("extension_threshold_pct", 0.10)))
    breakout_lookback: int = field(default_factory=lambda: int(_candle_defaults().get("breakout_lookback", 50)))
    pullback_ma: int = field(default_factory=lambda: int(_candle_defaults().get("pullback_ma", 20)))


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
    return _Metrics(o=o, h=h, low=low, c=c, body=body, rng=rng, upper_wick=upper_wick, lower_wick=lower_wick)


def _is_doji(m: _Metrics, cfg: CandleConfig) -> bool:
    if m.rng <= 0:
        return False
    body_ratio = m.body / m.rng
    return body_ratio <= cfg.doji_body_ratio


def _is_hammer(m: _Metrics, cfg: CandleConfig) -> bool:
    if m.rng <= 0 or m.body <= 0:
        return False
    return (
        m.lower_wick > cfg.hammer_lower_wick_mult * m.body
        and m.upper_wick <= cfg.hammer_max_opposite_wick_ratio * m.rng
    )


def _is_shooting_star(m: _Metrics, cfg: CandleConfig) -> bool:
    if m.rng <= 0 or m.body <= 0:
        return False
    return (
        m.upper_wick >= cfg.hammer_lower_wick_mult * m.body
        and m.lower_wick <= cfg.hammer_max_opposite_wick_ratio * m.rng
    )
