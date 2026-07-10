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
from swing_screener.indicators.volume_profile import (
    VolumeProfileConfig,
    build_volume_profile,
)
from swing_screener.indicators.swings import swing_points
from swing_screener.indicators.vwap import anchored_vwap
from swing_screener.settings.manager import get_settings_manager
from swing_screener.utils.dataframe_helpers import get_field_matrix

PROFILE_TYPE = "approximate_bar_based"
APPROX_WARNING = (
    "Approximate volume profile built from OHLCV bars, not tick-level trades."
)

VolumeZoneAction = Literal["Long", "Short", "Watch", "No Trade"]
MarketBias = Literal["bullish", "bearish", "neutral"]
ZoneKind = Literal["poc", "hvn", "lvn"]
ZoneRole = Literal["buyer_defense", "seller_defense", "neutral"]


def _vz_defaults() -> dict:
    return get_settings_manager().get_low_level_defaults_payload("volume_zones")


@dataclass(frozen=True)
class VolumeZoneConfig:
    bins: int = field(default_factory=lambda: int(_vz_defaults().get("bins", 24)))
    hvn_peak_ratio: float = field(
        default_factory=lambda: float(_vz_defaults().get("hvn_peak_ratio", 0.70))
    )
    lvn_peak_ratio: float = field(
        default_factory=lambda: float(_vz_defaults().get("lvn_peak_ratio", 0.20))
    )
    min_bars: int = field(
        default_factory=lambda: int(_vz_defaults().get("min_bars", 20))
    )
    lookback: int = field(
        default_factory=lambda: int(_vz_defaults().get("lookback", 120))
    )
    swing_window: int = field(
        default_factory=lambda: int(_vz_defaults().get("swing_window", 3))
    )
    proximity_atr_mult: float = field(
        default_factory=lambda: float(_vz_defaults().get("proximity_atr_mult", 1.5))
    )
    stop_buffer_atr_mult: float = field(
        default_factory=lambda: float(_vz_defaults().get("stop_buffer_atr_mult", 0.5))
    )
    retest_tol_atr_mult: float = field(
        default_factory=lambda: float(_vz_defaults().get("retest_tol_atr_mult", 0.25))
    )
    min_rr: float = field(
        default_factory=lambda: float(_vz_defaults().get("min_rr", 2.0))
    )

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
        {
            "h": highs.get(symbol),
            "l": lows.get(symbol),
            "c": closes.get(symbol),
            "v": vols.get(symbol),
        },
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
    return xf if math.isfinite(xf) else None


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
    if (bias == "bullish" and direction == "long") or (
        bias == "bearish" and direction == "short"
    ):
        score += 25.0
    elif bias == "neutral":
        score += 10.0
    clamped_proximity = min(max(proximity_ratio, 0.0), 2.0)
    score += 20.0 * (1.0 - clamped_proximity / 2.0)
    if rr is not None and rr > 0:
        score += 20.0 * min(rr, 3.0) / 3.0
    score += 15.0 * min(retest_count, 3) / 3.0
    if rel_volume is not None and rel_volume > 1.0:
        score += 10.0
    if close is not None and vwap is not None:
        if (direction == "long" and close >= vwap) or (
            direction == "short" and close <= vwap
        ):
            score += 10.0
    return round(min(score, 100.0), 1)


def _no_trade(
    symbol: str,
    interval: str,
    lookback: int,
    dq: DataQuality,
    bias: MarketBias = "neutral",
    rationale: list[str] | None = None,
) -> VolumeZoneAnalysis:
    warnings = list(dict.fromkeys([APPROX_WARNING, *dq.warnings]))
    return VolumeZoneAnalysis(
        symbol=symbol,
        interval=interval,
        lookback=lookback,
        data_quality=dq,
        profile_type=PROFILE_TYPE,
        market_bias=bias,
        setup_type="none",
        action="No Trade",
        confidence_score=0.0,
        rationale=rationale
        or ["Insufficient or low-quality data for volume-zone analysis."],
        key_levels=KeyLevels(),
        volume_zones=[],
        trade_plan=ZoneTradePlan(),
        retest_count=0,
        warnings=warnings,
    )


def analyze_volume_zones(
    symbol: str,
    ohlcv: pd.DataFrame,
    *,
    interval: str = "1d",
    lookback: int = 120,
    min_rr: float = 2.0,
    cfg: VolumeZoneConfig = VolumeZoneConfig(),
) -> VolumeZoneAnalysis:
    symbol = symbol.strip().upper()
    frame = _extract_symbol_frame(ohlcv, symbol)
    pf = frame.iloc[-lookback:] if frame is not None else None

    if pf is None or len(pf) < cfg.min_bars or float(pf["v"].sum()) <= 0:
        bars = 0 if pf is None else len(pf)
        dq = DataQuality(
            ok=False,
            bars=bars,
            warnings=[f"Only {bars} usable bars; need >= {cfg.min_bars}."],
        )
        return _no_trade(symbol, interval, lookback, dq)

    assert frame is not None
    high, low, close_series, volume = frame["h"], frame["l"], frame["c"], frame["v"]
    close = float(close_series.iloc[-1])

    sma20 = sma_per_ticker(close_series, 20)
    sma50 = sma_per_ticker(close_series, 50)
    sma200 = sma_per_ticker(close_series, 200)
    atr14 = compute_atr_per_ticker(high, low, close_series, window=14)
    # VWAP and swings describe the analysis window, so anchor them to the same
    # lookback slice the volume profile uses (not the full downloaded history,
    # which is longer because SMA200 needs >= 200 bars).
    vwap = anchored_vwap(pf["h"], pf["l"], pf["c"], pf["v"])
    rel_volume = trailing_volume_ratio(
        volume.to_numpy(dtype=float), len(volume) - 1, 20
    )
    swings = swing_points(pf["h"], pf["l"], window=cfg.swing_window)

    profile = build_volume_profile(
        pf["h"], pf["l"], pf["c"], pf["v"], cfg.profile_config()
    )
    dq = DataQuality(ok=True, bars=len(pf), warnings=[])

    key_levels = KeyLevels(
        price=close,
        poc=_f(profile.poc.center) if profile else None,
        vwap=_f(vwap),
        sma20=_f(sma20),
        sma50=_f(sma50),
        sma200=_f(sma200),
        atr14=_f(atr14),
        swing_high=swings.swing_high,
        swing_low=swings.swing_low,
        rel_volume=_f(rel_volume),
    )

    if profile is None:
        return _no_trade(
            symbol,
            interval,
            lookback,
            DataQuality(
                ok=False, bars=len(pf), warnings=["Volume profile could not be built."]
            ),
        )

    bias = _market_bias(close, sma20, sma50, sma200)
    candidate_zones = [profile.poc, *profile.hvns]
    analysis_zones: list[AnalysisZone] = [
        AnalysisZone(
            kind=z.kind,
            role=_zone_role(z.center, close),
            price_low=z.price_low,
            price_high=z.price_high,
            center=z.center,
            volume_share=z.volume_share,
        )
        for z in [profile.poc, *profile.hvns, *profile.lvns]
    ]

    atr = _f(atr14) or (0.02 * close)
    proximity = cfg.proximity_atr_mult * atr
    supports = [
        z
        for z in candidate_zones
        if z.center < close and (close - z.price_high) <= proximity
    ]
    resistances = [
        z
        for z in candidate_zones
        if z.center > close and (z.price_low - close) <= proximity
    ]

    setup_type = "none"
    direction = "none"
    entry = stop = target = rr = None
    chosen = None
    proximity_ratio = 2.0

    if bias != "bearish" and supports:
        chosen = max(supports, key=lambda z: z.volume_share)
        direction = "long"
        setup_type = (
            "hvn_support_retest" if chosen.kind != "poc" else "poc_support_retest"
        )
        entry = close
        stop = chosen.price_low - cfg.stop_buffer_atr_mult * atr
        if key_levels.swing_low is not None:
            stop = min(stop, key_levels.swing_low - cfg.stop_buffer_atr_mult * atr)
        above = sorted(
            [z for z in candidate_zones if z.center > close], key=lambda z: z.center
        )
        target = above[0].center if above else key_levels.swing_high
        proximity_ratio = (close - chosen.price_high) / atr if atr else 2.0
    elif bias != "bullish" and resistances:
        chosen = max(resistances, key=lambda z: z.volume_share)
        direction = "short"
        setup_type = (
            "hvn_resistance_retest" if chosen.kind != "poc" else "poc_resistance_retest"
        )
        entry = close
        stop = chosen.price_high + cfg.stop_buffer_atr_mult * atr
        if key_levels.swing_high is not None:
            stop = max(stop, key_levels.swing_high + cfg.stop_buffer_atr_mult * atr)
        below = sorted(
            [z for z in candidate_zones if z.center < close],
            key=lambda z: z.center,
            reverse=True,
        )
        target = below[0].center if below else key_levels.swing_low
        proximity_ratio = (chosen.price_low - close) / atr if atr else 2.0

    if (
        direction != "none"
        and target is None
        and stop is not None
        and entry is not None
    ):
        risk = abs(entry - stop)
        target = entry + 2.0 * risk if direction == "long" else entry - 2.0 * risk

    if (
        direction == "long"
        and stop is not None
        and target is not None
        and entry is not None
        and entry - stop > 0
    ):
        rr = (target - entry) / (entry - stop)
    elif (
        direction == "short"
        and stop is not None
        and target is not None
        and entry is not None
        and stop - entry > 0
    ):
        rr = (entry - target) / (stop - entry)

    retest_count = (
        _count_retests(pf["c"], chosen.price_low, chosen.price_high) if chosen else 0
    )

    if direction == "none" or rr is None or rr <= 0:
        action: VolumeZoneAction = "No Trade" if direction == "none" else "Watch"
    elif rr >= min_rr and (
        (direction == "long" and bias == "bullish")
        or (direction == "short" and bias == "bearish")
    ):
        action = "Long" if direction == "long" else "Short"
    else:
        action = "Watch"

    confidence = _confidence(
        bias=bias,
        direction=direction,
        proximity_ratio=proximity_ratio,
        rr=rr,
        retest_count=retest_count,
        rel_volume=key_levels.rel_volume,
        close=close,
        vwap=key_levels.vwap,
    )

    rationale = _build_rationale(
        bias, setup_type, chosen, rr, retest_count, key_levels, min_rr, action
    )

    return VolumeZoneAnalysis(
        symbol=symbol,
        interval=interval,
        lookback=lookback,
        data_quality=dq,
        profile_type=PROFILE_TYPE,
        market_bias=bias,
        setup_type=setup_type,
        action=action,
        confidence_score=confidence,
        rationale=rationale,
        key_levels=key_levels,
        volume_zones=analysis_zones,
        trade_plan=ZoneTradePlan(
            direction=direction,
            entry=_f(entry),
            stop=_f(stop),
            target=_f(target),
            rr=_f(rr),
        ),
        retest_count=retest_count,
        warnings=[APPROX_WARNING],
    )


def _build_rationale(
    bias: MarketBias,
    setup_type: str,
    chosen,
    rr: float | None,
    retest_count: int,
    key_levels: KeyLevels,
    min_rr: float,
    action: VolumeZoneAction,
) -> list[str]:
    out = [f"Market bias is {bias} based on price vs SMA20/50/200 alignment."]
    if chosen is not None:
        out.append(
            f"Nearest heavy volume zone ({chosen.kind.upper()}) sits at "
            f"{chosen.price_low:.2f}-{chosen.price_high:.2f} (share {chosen.volume_share:.0%})."
        )
        out.append(
            f"Price has retested that zone {retest_count} time(s) over the lookback."
        )
    if key_levels.poc is not None:
        out.append(f"Point of control (POC) is at {key_levels.poc:.2f}.")
    if rr is not None:
        out.append(f"Setup reward:risk is {rr:.2f} (min required {min_rr:.2f}).")
    out.append(f"Resulting action: {action}.")
    return out
