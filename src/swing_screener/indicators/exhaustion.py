from __future__ import annotations

import math
from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class ExhaustionResult:
    score: float  # 0–10
    label: str    # "fine" | "watch" | "exit"
    components: dict[str, float]  # per-signal scores (nan = insufficient data)


_WEIGHTS: dict[str, float] = {
    "ext_sma20": 2.5,
    "slope_sma20": 2.0,
    "vol_distribution": 2.0,
    "range_decay": 2.0,
    "rsi_overbought": 1.5,
}


def _label_from_score(score: float) -> str:
    if score >= 7.0:
        return "exit"
    if score >= 4.0:
        return "watch"
    return "fine"


def _ext_sma20(close: pd.Series) -> float:
    if len(close) < 21:
        return float("nan")
    sma20 = float(close.iloc[-21:-1].mean())
    if sma20 == 0:
        return float("nan")
    dist_pct = (float(close.iloc[-1]) / sma20 - 1.0) * 100.0
    if dist_pct <= 3.0:
        return 0.0
    return min((dist_pct - 3.0) / 12.0, 1.0)  # 12 = (15 - 3)


def _slope_sma20(close: pd.Series) -> float:
    if len(close) < 40:
        return float("nan")
    sma_now = float(close.iloc[-20:].mean())
    sma_prev = float(close.iloc[-40:-20].mean())
    if sma_prev == 0:
        return float("nan")
    slope = (sma_now / sma_prev) - 1.0
    if slope < 0:
        return 1.0
    if slope < 0.001:
        return 0.5
    return 0.0


def _vol_distribution(close: pd.Series, volume: pd.Series) -> float:
    if len(volume) < 20 or len(close) < 21:
        return float("nan")
    avg_vol_20 = float(volume.iloc[-20:].mean())
    if avg_vol_20 == 0:
        return float("nan")
    recent_vol_ratio = float(volume.iloc[-3:].mean()) / avg_vol_20
    sma20 = float(close.iloc[-21:-1].mean())
    if sma20 == 0:
        return float("nan")
    dist_pct = (float(close.iloc[-1]) / sma20 - 1.0) * 100.0
    if dist_pct <= 5.0:
        return 0.0
    # Score 1.0 at ratio ≤ 0.7, 0.0 at ratio ≥ 1.0
    return max(0.0, min((1.0 - recent_vol_ratio) / 0.3, 1.0))


def _range_decay(close: pd.Series, high: pd.Series, low: pd.Series) -> float:
    if len(close) < 20 or len(high) < 20 or len(low) < 20:
        return float("nan")
    high_20 = float(high.iloc[-20:].max())
    low_20 = float(low.iloc[-20:].min())
    rng = high_20 - low_20
    if rng <= 0:
        return float("nan")
    clr = max(0.0, min((float(close.iloc[-1]) - low_20) / rng, 1.0))
    if clr >= 0.8:
        return 0.0
    if clr <= 0.3:
        return 1.0
    return (0.8 - clr) / 0.5


def _rsi_overbought(close: pd.Series, period: int = 14) -> float:
    if len(close) < period + 1:
        return float("nan")
    deltas = close.diff().dropna().iloc[-period:]
    if len(deltas) < period:
        return float("nan")
    avg_gain = float(deltas.clip(lower=0).mean())
    avg_loss = float((-deltas).clip(lower=0).mean())
    if avg_gain == 0 and avg_loss == 0:
        rsi = 50.0
    elif avg_loss == 0:
        rsi = 100.0
    else:
        rsi = 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))
    if rsi <= 65.0:
        return 0.0
    return min((rsi - 65.0) / 15.0, 1.0)


def compute_exhaustion_score(
    close: pd.Series,
    high: pd.Series,
    low: pd.Series,
    volume: pd.Series,
) -> ExhaustionResult:
    """
    Composite trend exhaustion score (0–10) for a single position's price series.

    Higher = more likely the trend is topping out. Advisory only.
    Each component is nan when data is insufficient; contributes 0 to score.
    """
    raw: dict[str, float] = {}

    for name, fn, args in [
        ("ext_sma20", _ext_sma20, (close,)),
        ("slope_sma20", _slope_sma20, (close,)),
        ("vol_distribution", _vol_distribution, (close, volume)),
        ("range_decay", _range_decay, (close, high, low)),
        ("rsi_overbought", _rsi_overbought, (close,)),
    ]:
        try:
            raw[name] = fn(*args)  # type: ignore[operator]
        except Exception:
            raw[name] = float("nan")

    score = sum(
        raw[name] * weight
        for name, weight in _WEIGHTS.items()
        if not math.isnan(raw.get(name, float("nan")))
    )

    return ExhaustionResult(score=round(score, 2), label=_label_from_score(score), components=raw)
