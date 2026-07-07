"""Deterministic, advisory single-symbol volume-zone analysis.

Consumes an in-memory OHLCV MultiIndex(field, ticker) frame and emits exactly one
action in {Long, Short, Watch, No Trade}. Pure with respect to inputs: no time or
randomness. Approximate: the volume profile is built from OHLCV bars, not
tick-level trades.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from swing_screener.indicators.volume_profile import VolumeProfileConfig
from swing_screener.settings.manager import get_settings_manager

PROFILE_TYPE = "approximate_bar_based"
APPROX_WARNING = "Approximate volume profile built from OHLCV bars, not tick-level trades."

VolumeZoneAction = Literal["Long", "Short", "Watch", "No Trade"]
MarketBias = Literal["bullish", "bearish", "neutral"]
ZoneKind = Literal["poc", "hvn", "lvn"]
ZoneRole = Literal["buyer_defense", "seller_defense", "neutral"]


def _vz_defaults() -> dict:
    return get_settings_manager().get_low_level_defaults_payload("volume_zones")


@dataclass(frozen=True)
class VolumeZoneConfig:
    bins: int = field(default_factory=lambda: int(_vz_defaults().get("bins", 24)))
    hvn_peak_ratio: float = field(default_factory=lambda: float(_vz_defaults().get("hvn_peak_ratio", 0.70)))
    lvn_peak_ratio: float = field(default_factory=lambda: float(_vz_defaults().get("lvn_peak_ratio", 0.20)))
    min_bars: int = field(default_factory=lambda: int(_vz_defaults().get("min_bars", 20)))
    lookback: int = field(default_factory=lambda: int(_vz_defaults().get("lookback", 120)))
    swing_window: int = field(default_factory=lambda: int(_vz_defaults().get("swing_window", 3)))
    proximity_atr_mult: float = field(default_factory=lambda: float(_vz_defaults().get("proximity_atr_mult", 1.5)))
    stop_buffer_atr_mult: float = field(default_factory=lambda: float(_vz_defaults().get("stop_buffer_atr_mult", 0.5)))
    retest_tol_atr_mult: float = field(default_factory=lambda: float(_vz_defaults().get("retest_tol_atr_mult", 0.25)))
    min_rr: float = field(default_factory=lambda: float(_vz_defaults().get("min_rr", 2.0)))

    def profile_config(self) -> VolumeProfileConfig:
        return VolumeProfileConfig(
            bins=self.bins,
            hvn_peak_ratio=self.hvn_peak_ratio,
            lvn_peak_ratio=self.lvn_peak_ratio,
            min_bars=self.min_bars,
        )


@dataclass(frozen=True)
class AnalysisZone:
    kind: ZoneKind
    role: ZoneRole
    price_low: float
    price_high: float
    center: float
    volume_share: float


@dataclass(frozen=True)
class DataQuality:
    ok: bool
    bars: int
    warnings: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class KeyLevels:
    price: float | None = None
    poc: float | None = None
    vwap: float | None = None
    sma20: float | None = None
    sma50: float | None = None
    sma200: float | None = None
    atr14: float | None = None
    swing_high: float | None = None
    swing_low: float | None = None
    rel_volume: float | None = None


@dataclass(frozen=True)
class ZoneTradePlan:
    direction: str = "none"
    entry: float | None = None
    stop: float | None = None
    target: float | None = None
    rr: float | None = None


@dataclass(frozen=True)
class VolumeZoneAnalysis:
    symbol: str
    interval: str
    lookback: int
    data_quality: DataQuality
    profile_type: str
    market_bias: MarketBias
    setup_type: str
    action: VolumeZoneAction
    confidence_score: float
    rationale: list[str]
    key_levels: KeyLevels
    volume_zones: list[AnalysisZone]
    trade_plan: ZoneTradePlan
    retest_count: int
    warnings: list[str]
