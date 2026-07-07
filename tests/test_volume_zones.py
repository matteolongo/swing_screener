from __future__ import annotations

import pandas as pd
import pytest

from swing_screener.analysis import volume_zones as vz
from swing_screener.analysis.volume_zones import (
    APPROX_WARNING,
    PROFILE_TYPE,
    VolumeZoneConfig,
)


def test_defaults_load_from_config():
    cfg = VolumeZoneConfig()
    assert cfg.bins == 24
    assert cfg.min_rr == 2.0
    assert cfg.lookback == 120
    assert cfg.swing_window == 3


def test_constants():
    assert PROFILE_TYPE == "approximate_bar_based"
    assert APPROX_WARNING == "Approximate volume profile built from OHLCV bars, not tick-level trades."


def _ohlcv(close, high=None, low=None, volume=None, ticker="TEST"):
    n = len(close)
    idx = pd.date_range("2024-01-01", periods=n, freq="B")
    high = high or [c * 1.01 for c in close]
    low = low or [c * 0.99 for c in close]
    volume = volume or [1000.0] * n
    arrays = {"Close": close, "High": high, "Low": low, "Volume": volume}
    frames = {f: pd.DataFrame({ticker: vals}, index=idx) for f, vals in arrays.items()}
    combined = pd.concat(frames, axis=1)
    combined.columns = pd.MultiIndex.from_tuples([(f, ticker) for f, _ in combined.columns])
    return combined


def test_extract_symbol_frame_returns_full_aligned_frame():
    ohlcv = _ohlcv([10.0 + i for i in range(50)])
    frame = vz._extract_symbol_frame(ohlcv, "TEST")
    assert list(frame.columns) == ["h", "l", "c", "v"]
    assert len(frame) == 50
    assert frame["c"].iloc[-1] == pytest.approx(59.0)


def test_extract_symbol_frame_none_for_missing_symbol():
    ohlcv = _ohlcv([10.0, 11.0, 12.0])
    assert vz._extract_symbol_frame(ohlcv, "NOPE") is None


def test_market_bias_rules():
    assert vz._market_bias(110, 100, 90, 80) == "bullish"
    assert vz._market_bias(70, 80, 90, 100) == "bearish"
    assert vz._market_bias(100, 100, 100, 100) == "neutral"
    assert vz._market_bias(110, 100, 90, float("nan")) == "bullish"


def test_zone_role_by_position():
    assert vz._zone_role(90.0, price=100.0) == "buyer_defense"
    assert vz._zone_role(110.0, price=100.0) == "seller_defense"


def test_count_retests_counts_distinct_reentries():
    close = pd.Series([10.0, 12.0, 10.0, 13.0, 10.0, 14.0])
    assert vz._count_retests(close, 9.5, 10.5) == 3


def test_confidence_in_range_and_monotone_on_rr():
    lo = vz._confidence(
        bias="bullish",
        direction="long",
        proximity_ratio=0.2,
        rr=1.0,
        retest_count=1,
        rel_volume=1.2,
        close=100.0,
        vwap=95.0,
    )
    hi = vz._confidence(
        bias="bullish",
        direction="long",
        proximity_ratio=0.2,
        rr=4.0,
        retest_count=1,
        rel_volume=1.2,
        close=100.0,
        vwap=95.0,
    )
    assert 0.0 <= lo <= 100.0 and 0.0 <= hi <= 100.0
    assert hi >= lo
