"""Deterministic candlestick pattern detection.

Pure functions: OHLCV in, patterns out. No state, no I/O. Thresholds come from
config (low_level.candles). Patterns are advisory and contextual — they never
feed the ranking/setup score.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

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


@dataclass(frozen=True)
class CandlePattern:
    ticker: str
    bar_index: int
    date: str
    name: str
    direction: str  # bullish | bearish | neutral
    key_level: float
    context: str  # at_breakout | at_pullback | extended | none


def _field(ohlcv: pd.DataFrame, name: str) -> pd.DataFrame | None:
    if not isinstance(ohlcv.columns, pd.MultiIndex):
        return None
    if name not in ohlcv.columns.get_level_values(0):
        return None
    sub = ohlcv[name]
    return sub if isinstance(sub, pd.DataFrame) else sub.to_frame()


def detect_patterns(
    ohlcv: pd.DataFrame,
    tickers: Iterable[str] | None = None,
    *,
    lookback: int | None = None,
    cfg: CandleConfig = CandleConfig(),
) -> dict[str, list[CandlePattern]]:
    """Detect curated candlestick patterns over the last `lookback` bars per
    ticker. Context is computed for the latest bar and attached to patterns on
    that bar; older patterns get context 'none'. Returns {} when OHLC absent."""
    o_m, h_m, low_m, c_m = (_field(ohlcv, f) for f in ("Open", "High", "Low", "Close"))
    if any(x is None for x in (o_m, h_m, low_m, c_m)) or c_m.empty:
        return {}

    lb = lookback if lookback is not None else cfg.lookback
    all_tickers = list(c_m.columns)
    if tickers is not None:
        wanted = {str(t).strip().upper() for t in tickers if t and str(t).strip()}
        all_tickers = [t for t in all_tickers if str(t).strip().upper() in wanted]

    out: dict[str, list[CandlePattern]] = {}
    for tk in all_tickers:
        o = o_m[tk]
        h = h_m[tk]
        low = low_m[tk]
        c = c_m[tk]
        frame = pd.concat([o, h, low, c], axis=1, keys=["o", "h", "l", "c"]).dropna()
        # Need at least 2 bars for prev/cur, and a full lookback window before scanning.
        if len(frame) < max(2, lb):
            out[tk] = []
            continue

        latest_ctx = _context_for_latest(c, cfg)
        n = len(frame)
        start = max(1, n - lb)
        patterns: list[CandlePattern] = []
        for i in range(start, n):
            row = frame.iloc[i]
            prev = frame.iloc[i - 1]
            m = _bar_metrics(row.o, row.h, row.l, row.c)
            pm = _bar_metrics(prev.o, prev.h, prev.l, prev.c)
            date = str(frame.index[i].date())
            ctx = latest_ctx if i == n - 1 else "none"

            found: list[tuple[str, str, float]] = []  # (name, direction, key_level)
            if _is_hammer(m, cfg):
                found.append(("hammer", "bullish", m.low))
            if _is_shooting_star(m, cfg):
                found.append(("shooting_star", "bearish", m.h))
            if _is_doji(m, cfg):
                found.append(("doji", "neutral", m.c))
            if _is_bullish_engulfing(pm, m):
                found.append(("bullish_engulfing", "bullish", m.low))
            if _is_bearish_engulfing(pm, m):
                found.append(("bearish_engulfing", "bearish", m.h))
            if _is_inside_bar(pm, m):
                found.append(("inside_bar", "bullish", m.low))
            if _is_outside_bar(pm, m):
                direction = "bullish" if m.c >= m.o else "bearish"
                found.append(
                    (
                        "outside_bar",
                        direction,
                        m.low if direction == "bullish" else m.h,
                    )
                )

            for name, direction, key_level in found:
                patterns.append(
                    CandlePattern(
                        ticker=str(tk),
                        bar_index=i,
                        date=date,
                        name=name,
                        direction=direction,
                        key_level=float(key_level),
                        context=ctx,
                    )
                )
        out[tk] = patterns
    return out


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
