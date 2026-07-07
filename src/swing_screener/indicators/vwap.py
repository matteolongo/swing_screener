"""Anchored volume-weighted average price from OHLCV bars."""

from __future__ import annotations

import pandas as pd


def anchored_vwap(
    high: pd.Series, low: pd.Series, close: pd.Series, volume: pd.Series
) -> float:
    """Sum(typical_price * volume) / Sum(volume) over all aligned bars.

    typical_price = (high + low + close) / 3. Returns NaN when there are no aligned
    bars or total volume is zero. Approximate: derived from bar OHLCV, not trades.
    """
    frame = pd.concat({"h": high, "l": low, "c": close, "v": volume}, axis=1).dropna()
    total_volume = float(frame["v"].sum()) if len(frame) else 0.0
    if len(frame) == 0 or total_volume <= 0:
        return float("nan")
    typical = (frame["h"] + frame["l"] + frame["c"]) / 3.0
    return float((typical * frame["v"]).sum() / total_volume)
