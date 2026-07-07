"""Deterministic, advisory single-symbol volume-zone analysis.

Consumes an in-memory OHLCV MultiIndex(field, ticker) frame and emits exactly one
action in {Long, Short, Watch, No Trade}. Pure with respect to inputs: no time or
randomness. Approximate: the volume profile is built from OHLCV bars, not
tick-level trades.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import math
from typing import Literal

import pandas as pd

from swing_screener.indicators.trend import sma_per_ticker
from swing_screener.indicators.volatility import compute_atr_per_ticker
from swing_screener.indicators.volume_pressure import trailing_volume_ratio
from swing_screener.indicators.volume_profile import VolumeProfileConfig
from swing_screener.settings.manager import get_settings_manager
from swing_screener.utils.dataframe_helpers import get_field_matrix

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


def _extract_symbol_frame(ohlcv: pd.DataFrame, symbol: str) -> pd.DataFrame | None:
    """Full aligned (h, l, c, v) frame for one symbol."""
    try:
        highs = get_field_matrix(ohlcv, "High")
        lows = get_field_matrix(ohlcv, "Low")
        closes = get_field_matrix(ohlcv, "Close")
        vols = get_field_matrix(ohlcv, "Volume")
    except ValueError:
        return None
    if symbol not in closes.columns:
        return None
    frame = pd.concat(
        {"h": highs.get(symbol), "l": lows.get(symbol), "c": closes.get(symbol), "v": vols.get(symbol)},
        axis=1,
    ).dropna()
    if frame.empty:
        return None
    return frame


def _f(x) -> float | None:
    """NaN/None -> None; else float."""
    if x is None:
        return None
    try:
        xf = float(x)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(xf) else xf


def _market_bias(close: float, sma20: float, sma50: float, sma200: float) -> MarketBias:
    c, s20, s50, s200 = _f(close), _f(sma20), _f(sma50), _f(sma200)
    if c is None or s20 is None or s50 is None:
        return "neutral"
    long_ok = s200 is None or s50 > s200
    short_ok = s200 is None or s50 < s200
    if c > s20 > s50 and long_ok:
        return "bullish"
    if c < s20 < s50 and short_ok:
        return "bearish"
    return "neutral"


def _zone_role(zone_center: float, price: float) -> ZoneRole:
    if zone_center < price:
        return "buyer_defense"
    if zone_center > price:
        return "seller_defense"
    return "neutral"


def _count_retests(close: pd.Series, price_low: float, price_high: float) -> int:
    """Distinct times the close series re-enters the [price_low, price_high] band."""
    inside_prev = False
    count = 0
    for value in close.to_numpy(dtype=float):
        inside = price_low <= value <= price_high
        if inside and not inside_prev:
            count += 1
        inside_prev = inside
    return count


def _confidence(
    *,
    bias: MarketBias,
    direction: str,
    proximity_ratio: float,
    rr: float | None,
    retest_count: int,
    rel_volume: float | None,
    close: float | None,
    vwap: float | None,
) -> float:
    """Transparent weighted score in [0, 100]."""
    score = 0.0
    if (bias == "bullish" and direction == "long") or (bias == "bearish" and direction == "short"):
        score += 25.0
    elif bias == "neutral":
        score += 10.0
    score += 20.0 * max(0.0, 1.0 - min(proximity_ratio, 2.0) / 2.0)
    if rr is not None and rr > 0:
        score += 20.0 * min(rr, 3.0) / 3.0
    score += 15.0 * min(retest_count, 3) / 3.0
    if rel_volume is not None and rel_volume > 1.0:
        score += 10.0
    if close is not None and vwap is not None:
        if (direction == "long" and close >= vwap) or (direction == "short" and close <= vwap):
            score += 10.0
    return round(min(score, 100.0), 1)
