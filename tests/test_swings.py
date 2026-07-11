from __future__ import annotations

import pandas as pd

from swing_screener.indicators.swings import SwingPoints, swing_points


def _s(vals):
    idx = pd.date_range("2024-01-01", periods=len(vals), freq="B")
    return pd.Series(vals, index=idx, dtype=float)


def test_detects_single_peak_and_trough():
    high = _s([10.0, 11.0, 15.0, 11.0, 10.0, 9.0, 10.0])
    low = _s([9.0, 8.0, 12.0, 8.0, 6.0, 7.0, 8.0])
    sp = swing_points(high, low, window=2)
    assert sp.swing_high == 15.0
    assert sp.swing_low == 6.0


def test_returns_latest_confirmed_pivot_when_multiple():
    high = _s([10.0, 14.0, 10.0, 9.0, 16.0, 9.0, 8.0])
    low = _s([5.0, 6.0, 5.0, 4.0, 6.0, 4.0, 3.0])
    sp = swing_points(high, low, window=1)
    assert sp.swing_high == 16.0


def test_none_when_insufficient_bars():
    high = _s([10.0, 11.0])
    low = _s([9.0, 8.0])
    sp = swing_points(high, low, window=3)
    assert sp == SwingPoints(swing_high=None, swing_low=None)


def test_deterministic():
    high = _s([10.0, 12.0, 11.0, 13.0, 10.0])
    low = _s([8.0, 7.0, 9.0, 6.0, 8.0])
    assert swing_points(high, low, window=1) == swing_points(high, low, window=1)
