from __future__ import annotations

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
