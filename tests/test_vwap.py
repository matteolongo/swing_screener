from __future__ import annotations

import math

import pandas as pd
import pytest

from swing_screener.indicators.vwap import anchored_vwap


def _s(vals):
    idx = pd.date_range("2024-01-01", periods=len(vals), freq="B")
    return pd.Series(vals, index=idx, dtype=float)


def test_constant_price_equals_that_price():
    h = _s([10.0, 10.0, 10.0])
    assert anchored_vwap(h, h.copy(), h.copy(), _s([100.0, 200.0, 50.0])) == pytest.approx(10.0)


def test_volume_weighting():
    h = _s([10.0, 20.0])
    v = _s([1.0, 3.0])
    assert anchored_vwap(h, h.copy(), h.copy(), v) == pytest.approx(17.5)


def test_typical_price_uses_hlc_mean():
    assert anchored_vwap(_s([12.0]), _s([6.0]), _s([9.0]), _s([10.0])) == pytest.approx(9.0)


def test_nan_when_zero_volume():
    h = _s([10.0, 11.0])
    assert math.isnan(anchored_vwap(h, h.copy(), h.copy(), _s([0.0, 0.0])))


def test_nan_when_empty_after_dropna():
    empty = pd.Series([], dtype=float)
    assert math.isnan(anchored_vwap(empty, empty, empty, empty))
