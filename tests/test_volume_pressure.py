from __future__ import annotations

import math

import pandas as pd
import pytest

from swing_screener.indicators.volume_pressure import (
    buy_sell_volume,
    confirm_pattern_volume,
    intrabar_pressure,
    trailing_volume_ratio,
    windowed_buy_pressure_ratio,
)

# ── intrabar_pressure ─────────────────────────────────────────────────────────


def test_pressure_close_at_high_is_one():
    assert intrabar_pressure(high=11.0, low=10.0, close=11.0) == pytest.approx(1.0)


def test_pressure_close_at_low_is_zero():
    assert intrabar_pressure(high=11.0, low=10.0, close=10.0) == pytest.approx(0.0)


def test_pressure_midpoint_is_half():
    assert intrabar_pressure(high=12.0, low=10.0, close=11.0) == pytest.approx(0.5)


def test_pressure_zero_range_bar_is_neutral():
    assert intrabar_pressure(high=10.0, low=10.0, close=10.0) == pytest.approx(0.5)


def test_pressure_clamped_when_close_outside_range():
    # defensive: close above high clamps to 1.0, below low clamps to 0.0
    assert intrabar_pressure(high=11.0, low=10.0, close=12.0) == pytest.approx(1.0)
    assert intrabar_pressure(high=11.0, low=10.0, close=9.0) == pytest.approx(0.0)


# ── buy_sell_volume ───────────────────────────────────────────────────────────


def test_buy_sell_volume_sums_to_total():
    buy, sell = buy_sell_volume(high=12.0, low=10.0, close=11.5, volume=1000.0)
    assert buy + sell == pytest.approx(1000.0)
    assert buy == pytest.approx(750.0)  # pressure 0.75
    assert sell == pytest.approx(250.0)


def test_buy_sell_volume_zero_range_splits_evenly():
    buy, sell = buy_sell_volume(high=10.0, low=10.0, close=10.0, volume=800.0)
    assert buy == pytest.approx(400.0)
    assert sell == pytest.approx(400.0)


# ── windowed_buy_pressure_ratio ───────────────────────────────────────────────


def _series(vals):
    idx = pd.date_range("2024-01-01", periods=len(vals), freq="B")
    return pd.Series(vals, index=idx, dtype=float)


def test_windowed_ratio_all_closes_at_high_is_one():
    n = 20
    high = _series([11.0] * n)
    low = _series([10.0] * n)
    close = _series([11.0] * n)  # every bar closes at its high
    volume = _series([1000.0] * n)
    assert windowed_buy_pressure_ratio(high, low, close, volume, n=20) == pytest.approx(
        1.0
    )


def test_windowed_ratio_all_closes_at_low_is_zero():
    n = 20
    high = _series([11.0] * n)
    low = _series([10.0] * n)
    close = _series([10.0] * n)
    volume = _series([1000.0] * n)
    assert windowed_buy_pressure_ratio(high, low, close, volume, n=20) == pytest.approx(
        0.0
    )


def test_windowed_ratio_volume_weighted():
    # bar 0 closes at high on huge volume, bar 1 at low on tiny volume → ratio near 1
    high = _series([11.0, 11.0])
    low = _series([10.0, 10.0])
    close = _series([11.0, 10.0])
    volume = _series([9000.0, 1000.0])
    ratio = windowed_buy_pressure_ratio(high, low, close, volume, n=2)
    assert ratio == pytest.approx(0.9)


def test_windowed_ratio_nan_when_insufficient_bars():
    high = _series([11.0] * 5)
    low = _series([10.0] * 5)
    close = _series([10.5] * 5)
    volume = _series([1000.0] * 5)
    assert math.isnan(windowed_buy_pressure_ratio(high, low, close, volume, n=20))


def test_windowed_ratio_nan_when_zero_volume():
    n = 20
    high = _series([11.0] * n)
    low = _series([10.0] * n)
    close = _series([10.5] * n)
    volume = _series([0.0] * n)
    assert math.isnan(windowed_buy_pressure_ratio(high, low, close, volume, n=20))


def test_windowed_ratio_zero_range_bars_treated_neutral():
    n = 20
    high = _series([10.0] * n)
    low = _series([10.0] * n)
    close = _series([10.0] * n)
    volume = _series([1000.0] * n)
    assert windowed_buy_pressure_ratio(high, low, close, volume, n=20) == pytest.approx(
        0.5
    )


def test_windowed_ratio_drops_missing_rows():
    # a NaN anywhere in a row removes that row; remaining must still reach n
    n = 21
    high = _series([11.0] * n)
    low = _series([10.0] * n)
    close = _series([11.0] * n)
    vol_vals = [1000.0] * n
    vol_vals[0] = float("nan")  # drop first row, leaves exactly 20 usable
    volume = _series(vol_vals)
    assert windowed_buy_pressure_ratio(high, low, close, volume, n=20) == pytest.approx(
        1.0
    )


# ── trailing_volume_ratio ─────────────────────────────────────────────────────


def test_trailing_volume_ratio_basic():
    vol = [1000.0] * 20 + [1500.0]
    assert trailing_volume_ratio(vol, idx=20, window=20) == pytest.approx(1.5)


def test_trailing_volume_ratio_none_when_insufficient_history():
    vol = [1000.0] * 10 + [1500.0]
    assert trailing_volume_ratio(vol, idx=10, window=20) is None


def test_trailing_volume_ratio_none_on_nan():
    vol = [1000.0] * 19 + [float("nan"), 1500.0]
    assert trailing_volume_ratio(vol, idx=20, window=20) is None


def test_trailing_volume_ratio_none_when_baseline_zero():
    vol = [0.0] * 20 + [1500.0]
    assert trailing_volume_ratio(vol, idx=20, window=20) is None


# ── confirm_pattern_volume ────────────────────────────────────────────────────


def test_confirm_bearish_high_volume_sell_pressure():
    # shooting-star case: elevated volume, close near low → confirmed
    assert (
        confirm_pattern_volume(
            "bearish", bar_pressure=0.2, volume_ratio=1.6, threshold=1.5
        )
        is True
    )


def test_confirm_bearish_rejected_when_buy_pressure():
    assert (
        confirm_pattern_volume(
            "bearish", bar_pressure=0.8, volume_ratio=1.6, threshold=1.5
        )
        is False
    )


def test_confirm_rejected_when_volume_not_elevated():
    assert (
        confirm_pattern_volume(
            "bearish", bar_pressure=0.2, volume_ratio=1.2, threshold=1.5
        )
        is False
    )


def test_confirm_bullish_high_volume_buy_pressure():
    assert (
        confirm_pattern_volume(
            "bullish", bar_pressure=0.9, volume_ratio=2.0, threshold=1.5
        )
        is True
    )


def test_confirm_neutral_is_none():
    assert (
        confirm_pattern_volume(
            "neutral", bar_pressure=0.5, volume_ratio=2.0, threshold=1.5
        )
        is None
    )


def test_confirm_none_when_volume_ratio_missing():
    assert (
        confirm_pattern_volume(
            "bearish", bar_pressure=0.2, volume_ratio=None, threshold=1.5
        )
        is None
    )
    assert (
        confirm_pattern_volume(
            "bullish", bar_pressure=0.9, volume_ratio=float("nan"), threshold=1.5
        )
        is None
    )


def test_confirm_boundary_at_threshold():
    # ratio exactly at threshold counts as elevated
    assert (
        confirm_pattern_volume(
            "bullish", bar_pressure=0.9, volume_ratio=1.5, threshold=1.5
        )
        is True
    )


# ── determinism ───────────────────────────────────────────────────────────────


def test_windowed_ratio_is_deterministic():
    n = 20
    high = _series([11.0 + i * 0.1 for i in range(n)])
    low = _series([10.0 + i * 0.1 for i in range(n)])
    close = _series([10.5 + i * 0.1 for i in range(n)])
    volume = _series([1000.0 + i for i in range(n)])
    first = windowed_buy_pressure_ratio(high, low, close, volume, n=20)
    second = windowed_buy_pressure_ratio(high, low, close, volume, n=20)
    assert first == second
