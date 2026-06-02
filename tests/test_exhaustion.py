import math
import pandas as pd
import pytest
from swing_screener.indicators.exhaustion import ExhaustionResult, _label_from_score, compute_exhaustion_score


def _series(values: list[float], name: str = "close") -> pd.Series:
    idx = pd.date_range("2024-01-01", periods=len(values), freq="B")
    return pd.Series(values, index=idx, name=name)


def _flat(n: int, val: float = 100.0) -> pd.Series:
    return _series([val] * n)


# ── ExhaustionResult label ────────────────────────────────────────────────────

def test_label_fine():
    assert _label_from_score(3.9) == "fine"
    assert _label_from_score(0.0) == "fine"


def test_label_watch():
    assert _label_from_score(4.0) == "watch"
    assert _label_from_score(6.99) == "watch"


def test_label_exit():
    assert _label_from_score(7.0) == "exit"
    assert _label_from_score(10.0) == "exit"


# ── ext_sma20 ─────────────────────────────────────────────────────────────────

def test_ext_sma20_below_threshold_scores_zero():
    # price flat = 0% above SMA20 → ext_sma20 = 0
    close = _flat(25, 100.0)
    result = compute_exhaustion_score(close, _flat(25), _flat(25), _flat(25))
    assert result.components["ext_sma20"] == pytest.approx(0.0)


def test_ext_sma20_at_15pct_scores_one():
    # last bar = 115, SMA20 of [100]*20 = 100 → 15% above → score = 1.0
    closes = [100.0] * 24 + [115.0]
    close = _series(closes)
    result = compute_exhaustion_score(close, _flat(25), _flat(25, 99.0), _flat(25))
    assert result.components["ext_sma20"] >= 0.99


def test_ext_sma20_nan_when_insufficient_data():
    close = _flat(15, 100.0)  # < 21 bars (guard is len < 21)
    result = compute_exhaustion_score(close, _flat(15), _flat(15), _flat(15))
    assert math.isnan(result.components["ext_sma20"])


# ── slope_sma20 ───────────────────────────────────────────────────────────────

def test_slope_sma20_negative_scores_one():
    # Declining price: SMA20 now < SMA20 prev → slope negative → 1.0
    closes = list(range(150, 90, -1))[:40]  # 40 bars, strongly declining
    close = _series(closes)
    result = compute_exhaustion_score(close, _flat(40), _flat(40), _flat(40))
    assert result.components["slope_sma20"] == pytest.approx(1.0)


def test_slope_sma20_positive_scores_zero():
    # Rising price: SMA20 now > SMA20 prev → slope positive → 0.0
    closes = list(range(100, 140))[:40]  # 40 bars, rising
    close = _series(closes)
    result = compute_exhaustion_score(close, _flat(40), _flat(40), _flat(40))
    assert result.components["slope_sma20"] == pytest.approx(0.0)


def test_slope_sma20_nan_when_insufficient_data():
    close = _flat(35, 100.0)  # < 40 bars
    result = compute_exhaustion_score(close, _flat(35), _flat(35), _flat(35))
    assert math.isnan(result.components["slope_sma20"])


# ── vol_distribution ─────────────────────────────────────────────────────────

def test_vol_distribution_low_volume_while_extended_scores_high():
    # Price 15% above SMA20, volume last 3 days = 40% of avg → ratio 0.4 < 0.7 → score 1.0
    closes = [100.0] * 24 + [115.0]
    close = _series(closes)
    volume_vals = [1000.0] * 22 + [400.0] * 3  # last 3 bars = 400, avg20 ≈ 1000
    volume = _series(volume_vals)
    result = compute_exhaustion_score(close, _flat(25), _flat(25, 99.0), volume)
    assert result.components["vol_distribution"] == pytest.approx(1.0)


def test_vol_distribution_zero_when_not_extended():
    # Price flat (0% above SMA20): low volume doesn't matter
    close = _flat(25, 100.0)
    volume_vals = [1000.0] * 22 + [100.0] * 3
    volume = _series(volume_vals)
    result = compute_exhaustion_score(close, _flat(25), _flat(25), volume)
    assert result.components["vol_distribution"] == pytest.approx(0.0)


def test_vol_distribution_nan_when_insufficient_data():
    close = _flat(15, 100.0)
    volume = _flat(15, 1000.0)
    result = compute_exhaustion_score(close, _flat(15), _flat(15), volume)
    assert math.isnan(result.components["vol_distribution"])


# ── range_decay ───────────────────────────────────────────────────────────────

def test_range_decay_closing_at_top_scores_zero():
    # high_20 = 110, low_20 = 90, last close = 109 → clr = (109-90)/(110-90) = 0.95 ≥ 0.8 → 0
    closes = [100.0] * 19 + [109.0]
    highs = [110.0] * 20
    lows = [90.0] * 20
    result = compute_exhaustion_score(
        _series(closes), _series(highs), _series(lows), _flat(20)
    )
    assert result.components["range_decay"] == pytest.approx(0.0)


def test_range_decay_closing_at_bottom_scores_one():
    # high_20 = 110, low_20 = 90, last close = 91 → clr = (91-90)/20 = 0.05 ≤ 0.3 → 1.0
    closes = [100.0] * 19 + [91.0]
    highs = [110.0] * 20
    lows = [90.0] * 20
    result = compute_exhaustion_score(
        _series(closes), _series(highs), _series(lows), _flat(20)
    )
    assert result.components["range_decay"] == pytest.approx(1.0)


def test_range_decay_nan_when_insufficient_data():
    result = compute_exhaustion_score(_flat(15), _flat(15), _flat(15), _flat(15))
    assert math.isnan(result.components["range_decay"])


# ── rsi_overbought ────────────────────────────────────────────────────────────

def test_rsi_overbought_below_65_scores_zero():
    # Flat price → RSI ≈ 50 → score 0
    close = _flat(20, 100.0)
    result = compute_exhaustion_score(close, _flat(20), _flat(20), _flat(20))
    assert result.components["rsi_overbought"] == pytest.approx(0.0)


def test_rsi_overbought_all_up_days_scores_high():
    # All gains, no losses → RSI = 100 → score = min((100-65)/15, 1.0) = 1.0
    closes = list(range(100, 116))  # 16 values, 15 gains
    close = _series(closes)
    result = compute_exhaustion_score(close, _flat(16), _flat(16), _flat(16))
    assert result.components["rsi_overbought"] == pytest.approx(1.0)


def test_rsi_overbought_nan_when_insufficient_data():
    close = _flat(10, 100.0)  # < 15 bars (period + 1)
    result = compute_exhaustion_score(close, _flat(10), _flat(10), _flat(10))
    assert math.isnan(result.components["rsi_overbought"])


# ── score thresholds ─────────────────────────────────────────────────────────

def test_score_zero_all_nan_gives_fine():
    # < 15 bars: all components nan → score 0 → "fine"
    result = compute_exhaustion_score(_flat(10), _flat(10), _flat(10), _flat(10))
    assert result.score == pytest.approx(0.0)
    assert result.label == "fine"


def test_score_at_threshold_watch():
    from swing_screener.indicators.exhaustion import _label_from_score
    assert _label_from_score(3.99) == "fine"
    assert _label_from_score(4.0) == "watch"
    assert _label_from_score(6.99) == "watch"
    assert _label_from_score(7.0) == "exit"


# ── error resilience ─────────────────────────────────────────────────────────

def test_missing_volume_gives_nan_for_vol_component_only():
    close = _flat(25, 100.0)
    high = _flat(25, 101.0)
    low = _flat(25, 99.0)
    empty_volume = pd.Series(dtype=float)  # empty
    result = compute_exhaustion_score(close, high, low, empty_volume)
    assert math.isnan(result.components["vol_distribution"])
    # other components should not be nan (sufficient data)
    assert not math.isnan(result.components["range_decay"])
