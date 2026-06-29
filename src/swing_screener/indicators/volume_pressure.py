"""Intrabar buy/sell volume-pressure proxy (deterministic, OHLC-derived).

Where a bar closes within its high–low range proxies the balance of buying vs
selling that occurred during the bar: a close near the high implies buyers were
in control, a close near the low implies sellers were. Weighted by volume, this
is the Accumulation/Distribution concept.

These are *proxies*. True delta volume (shares that hit the bid vs lifted the
ask) is NOT recoverable from end-of-day OHLCV — it needs tick or bid/ask data.
Every function here is pure: same input → same output, no time, no randomness.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def intrabar_pressure(high: float, low: float, close: float) -> float:
    """Fraction of the bar's range the close sits above the low, in ``[0, 1]``.

    ``1.0`` = closed at the high (buy-dominated), ``0.0`` = closed at the low
    (sell-dominated), ``0.5`` = neutral. A zero-range bar (``high == low``)
    carries no intrabar information and returns ``0.5``.
    """
    rng = high - low
    if rng <= 0:
        return 0.5
    return float(max(0.0, min((close - low) / rng, 1.0)))


def windowed_buy_pressure_ratio(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    volume: pd.Series,
    n: int = 20,
) -> float:
    """Volume-weighted mean close-location over the last *n* aligned bars.

    ``Σ buy_vol / Σ volume`` across the most recent ``n`` bars where all of
    high/low/close/volume are present. ``> 0.5`` = the recent range was
    accumulated, ``< 0.5`` = distributed.

    Returns ``NaN`` when fewer than ``n`` usable bars exist, when total volume
    is zero, or when inputs are missing.
    """
    frame = pd.concat({"h": high, "l": low, "c": close, "v": volume}, axis=1).dropna()
    if len(frame) < n:
        return float("nan")

    window = frame.iloc[-n:]
    rng = (window["h"] - window["l"]).to_numpy(dtype=float)
    above_low = (window["c"] - window["l"]).to_numpy(dtype=float)
    vol = window["v"].to_numpy(dtype=float)

    with np.errstate(divide="ignore", invalid="ignore"):
        pressure = np.where(rng > 0, np.clip(above_low / rng, 0.0, 1.0), 0.5)

    total_vol = float(vol.sum())
    if total_vol <= 0:
        return float("nan")
    buy_vol = float((vol * pressure).sum())
    return buy_vol / total_vol


def trailing_volume_ratio(volume, idx: int, window: int = 20) -> float | None:
    """``volume[idx]`` ÷ the mean of the ``window`` bars immediately before it.

    Mirrors the trailing-average convention used elsewhere (e.g. setup_quality's
    ``iloc[-21:-1]``): the current bar is excluded from its own baseline.
    Returns ``None`` when there are fewer than ``window`` prior bars, when any
    value involved is missing, or when the baseline average is not positive.
    """
    arr = np.asarray(volume, dtype=float)
    if idx < window or idx >= len(arr):
        return None
    cur = arr[idx]
    prev = arr[idx - window : idx]
    if np.isnan(cur) or np.isnan(prev).any():
        return None
    avg = float(prev.mean())
    if avg <= 0:
        return None
    return float(cur / avg)


def confirm_pattern_volume(
    direction: str,
    bar_pressure: float,
    volume_ratio: float | None,
    threshold: float,
) -> bool | None:
    """Whether a candle pattern fired on elevated, direction-aligned volume.

    Confirmed when the bar's volume is at least *threshold*× its trailing
    average AND intrabar pressure agrees with the pattern's direction
    (bearish → sell-dominated close, bullish → buy-dominated close).

    Returns ``None`` for neutral patterns (e.g. doji) or when volume data is
    insufficient to judge.
    """
    if direction == "neutral":
        return None
    if volume_ratio is None or (
        isinstance(volume_ratio, float) and np.isnan(volume_ratio)
    ):
        return None
    if volume_ratio < threshold:
        return False
    if direction == "bearish":
        return bool(bar_pressure < 0.5)
    if direction == "bullish":
        return bool(bar_pressure > 0.5)
    return None
