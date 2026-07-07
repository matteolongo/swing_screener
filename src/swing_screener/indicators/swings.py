"""Fractal swing-pivot detection from OHLC high/low series."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class SwingPoints:
    swing_high: float | None
    swing_low: float | None


def swing_points(high: pd.Series, low: pd.Series, window: int = 3) -> SwingPoints:
    """Return the most recent confirmed fractal pivot high and low."""
    if window < 1:
        raise ValueError("window must be >= 1")

    h = high.dropna().to_numpy(dtype=float)
    lows = low.dropna().to_numpy(dtype=float)
    n = min(len(h), len(lows))

    swing_high: float | None = None
    swing_low: float | None = None
    for i in range(window, n - window):
        seg_h = h[i - window : i + window + 1]
        if h[i] == seg_h.max():
            swing_high = float(h[i])
        seg_l = lows[i - window : i + window + 1]
        if lows[i] == seg_l.min():
            swing_low = float(lows[i])
    return SwingPoints(swing_high=swing_high, swing_low=swing_low)
