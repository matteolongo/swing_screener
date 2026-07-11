from __future__ import annotations

import pandas as pd
import pytest

from swing_screener.indicators.volume_profile import (
    VolumeProfileConfig,
    build_volume_profile,
)


def _series(vals):
    idx = pd.date_range("2024-01-01", periods=len(vals), freq="B")
    return pd.Series(vals, index=idx, dtype=float)


def _flat_bars(prices, volume=1000.0):
    """Zero-range bars (high==low==close) at each price; volume lands in one bin."""
    h = _series(prices)
    return h, h.copy(), h.copy(), _series([volume] * len(prices))


def test_returns_none_when_too_few_bars():
    high, low, close, volume = _flat_bars([10.0, 11.0])
    assert (
        build_volume_profile(high, low, close, volume, VolumeProfileConfig(min_bars=20))
        is None
    )


def test_returns_none_when_zero_total_volume():
    high, low, close, volume = _flat_bars([10.0 + i for i in range(25)], volume=0.0)
    assert (
        build_volume_profile(high, low, close, volume, VolumeProfileConfig(min_bars=5))
        is None
    )


def test_returns_none_when_no_price_range():
    high, low, close, volume = _flat_bars([10.0] * 25)
    assert (
        build_volume_profile(high, low, close, volume, VolumeProfileConfig(min_bars=5))
        is None
    )


def test_bins_partition_range_and_shares_sum_to_one():
    prices = [10.0 + 0.5 * i for i in range(25)]
    high, low, close, volume = _flat_bars(prices)
    prof = build_volume_profile(
        high, low, close, volume, VolumeProfileConfig(bins=12, min_bars=5)
    )
    assert prof is not None
    assert prof.price_low == pytest.approx(10.0)
    assert prof.price_high == pytest.approx(22.0)
    assert len(prof.bins) == 12
    assert prof.bins[0].price_low == pytest.approx(10.0)
    assert prof.bins[-1].price_high == pytest.approx(22.0)
    assert sum(b.volume_share for b in prof.bins) == pytest.approx(1.0)
    assert prof.total_volume == pytest.approx(25 * 1000.0)


def test_poc_is_the_heaviest_price_bin():
    prices = [10.0, 12.0, 14.0, 16.0, 18.0] + [20.0] * 20
    high, low, close, volume = _flat_bars(prices)
    prof = build_volume_profile(
        high, low, close, volume, VolumeProfileConfig(bins=12, min_bars=5)
    )
    assert prof is not None
    assert prof.poc.kind == "poc"
    assert prof.poc.price_low <= 20.0 <= prof.poc.price_high


def test_volume_distributed_across_touched_bins():
    high = _series([20.0] + [12.0] * 24)
    low = _series([10.0] + [12.0] * 24)
    close = _series([15.0] + [12.0] * 24)
    volume = _series([2400.0] + [10.0] * 24)
    prof = build_volume_profile(
        high, low, close, volume, VolumeProfileConfig(bins=12, min_bars=5)
    )
    assert prof is not None
    assert all(b.volume > 0 for b in prof.bins)


def test_hvn_and_lvn_extracted_relative_to_poc():
    prices = [10.0, 20.0] + [15.0] * 23
    high, low, close, volume = _flat_bars(prices)
    prof = build_volume_profile(
        high,
        low,
        close,
        volume,
        VolumeProfileConfig(
            bins=12, min_bars=5, hvn_peak_ratio=0.5, lvn_peak_ratio=0.2
        ),
    )
    assert prof is not None
    assert all(z.kind == "hvn" for z in prof.hvns)
    assert all(z.kind == "lvn" for z in prof.lvns)
    assert all(not (z.price_low <= prof.poc.center <= z.price_high) for z in prof.hvns)


def test_invalid_bins_raises():
    high, low, close, volume = _flat_bars([10.0 + i for i in range(25)])
    with pytest.raises(ValueError):
        build_volume_profile(high, low, close, volume, VolumeProfileConfig(bins=1))


def test_deterministic():
    prices = [10.0 + 0.3 * i for i in range(30)]
    high, low, close, volume = _flat_bars(prices)
    cfg = VolumeProfileConfig(min_bars=5)
    a = build_volume_profile(high, low, close, volume, cfg)
    b = build_volume_profile(high, low, close, volume, cfg)
    assert a == b
