# Exhaustion Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a composite exhaustion score (0–10) per open position to the existing `positions review` Markdown report, firing leading trend-exhaustion signals before the lagging SMA20 breach.

**Architecture:** New pure module `indicators/exhaustion.py` computes a weighted score from five daily OHLCV signals. `evaluate_positions()` in `portfolio/state.py` calls it per position and populates two new optional fields on both `PositionUpdate` and `Position`. Score is persisted in `positions.json` and rendered inline in the Degiro Markdown report.

**Tech Stack:** Python 3.11+, pandas, pytest. No new dependencies.

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Create | `src/swing_screener/indicators/exhaustion.py` | `ExhaustionResult` dataclass + `compute_exhaustion_score()` |
| Create | `tests/test_exhaustion.py` | Unit + integration tests |
| Modify | `src/swing_screener/portfolio/state.py` | `Position`, `PositionUpdate`, `_get_series`, `evaluate_positions`, `load_positions`, `save_positions`, `render_degiro_actions_md` |
| Modify | `api/models/portfolio.py` | Add optional exhaustion fields to API `PositionUpdate` |
| Modify | `api/services/portfolio_service.py` | Pass exhaustion fields at both `PositionUpdate` construction sites (lines 910, 993) |
| Modify | `data/README.md` | Migration note for new `positions.json` fields |

---

## Task 1: Create `exhaustion.py` with failing tests

**Files:**
- Create: `src/swing_screener/indicators/exhaustion.py`
- Create: `tests/test_exhaustion.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_exhaustion.py
import math
import pandas as pd
import pytest
from swing_screener.indicators.exhaustion import ExhaustionResult, compute_exhaustion_score


def _series(values: list[float], name: str = "close") -> pd.Series:
    idx = pd.date_range("2024-01-01", periods=len(values), freq="B")
    return pd.Series(values, index=idx, name=name)


def _flat(n: int, val: float = 100.0) -> pd.Series:
    return _series([val] * n)


# ── ExhaustionResult label ────────────────────────────────────────────────────

def test_label_fine():
    r = ExhaustionResult(score=3.9, label="fine", components={})
    assert r.label == "fine"


def test_label_watch():
    r = ExhaustionResult(score=5.0, label="watch", components={})
    assert r.label == "watch"


def test_label_exit():
    r = ExhaustionResult(score=7.0, label="exit", components={})
    assert r.label == "exit"


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
    close = _flat(15, 100.0)  # < 20 bars
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
    # Force score to ~4.0 by constructing a flat+slightly extended series
    # ext_sma20: 9% above SMA20 (24 bars at 100, last bar at 109) → (9-3)/12 = 0.5 → 0.5 * 2.5 = 1.25
    # slope_sma20: flat → score 0.5 → 0.5 * 2.0 = 1.0
    # others near 0
    # total ≈ 2.25 which is fine, not watch - so we need a more extended example
    # Easier: just assert label logic directly from score
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/matteo.longo/projects/randomness/trading/swing_screener
pytest tests/test_exhaustion.py -v 2>&1 | head -20
```

Expected: `ModuleNotFoundError: No module named 'swing_screener.indicators.exhaustion'`

- [ ] **Step 3: Implement `exhaustion.py`**

```python
# src/swing_screener/indicators/exhaustion.py
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
    if len(close) < 20:
        return float("nan")
    sma20 = float(close.iloc[-20:].mean())
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
    if len(volume) < 20 or len(close) < 20:
        return float("nan")
    avg_vol_20 = float(volume.iloc[-20:].mean())
    if avg_vol_20 == 0:
        return float("nan")
    recent_vol_ratio = float(volume.iloc[-3:].mean()) / avg_vol_20
    sma20 = float(close.iloc[-20:].mean())
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
    if avg_loss == 0:
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
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_exhaustion.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/indicators/exhaustion.py tests/test_exhaustion.py
git commit -m "feat(indicators): add exhaustion score module"
```

---

## Task 2: Add `dist_sma20_pct` to trend features

**Files:**
- Modify: `src/swing_screener/indicators/trend.py`
- Test: `tests/test_trend.py`

- [ ] **Step 1: Write failing test**

Open `tests/test_trend.py` and add at the end:

```python
def test_dist_sma20_pct_present_in_trend_features():
    """dist_sma20_pct should be present in compute_trend_features output."""
    from swing_screener.indicators.trend import compute_trend_features
    import pandas as pd

    n = 210
    dates = pd.date_range("2020-01-01", periods=n, freq="B")
    closes = [float(100 + i * 0.1) for i in range(n)]
    tuples = [("Close", "AAA")] * n
    idx = pd.MultiIndex.from_tuples(tuples)
    df = pd.DataFrame({"Close": closes}, index=dates)
    df.columns = pd.MultiIndex.from_tuples([("Close", "AAA")])
    feats = compute_trend_features(df)
    assert "dist_sma20_pct" in feats.columns
    assert not pd.isna(feats.loc["AAA", "dist_sma20_pct"])
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_trend.py::test_dist_sma20_pct_present_in_trend_features -v
```

Expected: `FAILED — AssertionError: 'dist_sma20_pct' not in columns`

- [ ] **Step 3: Add `dist_sma20_pct` to `compute_trend_features`**

In `src/swing_screener/indicators/trend.py`, find the block that computes `dist_sma50` and `dist_sma200` (around line 84–87) and add `dist_sma20` right after:

```python
        dist_sma50 = ((last_val / sma_mid_val) - 1.0) * 100.0 if pd.notna(sma_mid_val) else float("nan")
        dist_sma200 = ((last_val / sma_long_val) - 1.0) * 100.0 if pd.notna(sma_long_val) else float("nan")
        dist_sma20 = ((last_val / sma_fast_val) - 1.0) * 100.0 if pd.notna(sma_fast_val) else float("nan")
```

Then add `"dist_sma20_pct": dist_sma20` to the `results.append({...})` dict (place it alongside `dist_sma50_pct`):

```python
        results.append({
            "ticker": ticker,
            "last": last_val,
            f"sma{cfg.sma_fast}": sma_fast_val,
            f"sma{cfg.sma_mid}": sma_mid_val,
            f"sma{cfg.sma_long}": sma_long_val,
            "trend_ok": trend_ok,
            "dist_sma20_pct": dist_sma20,
            "dist_sma50_pct": dist_sma50,
            "dist_sma200_pct": dist_sma200,
            "sma20_slope": sma20_slope,
            "sma50_slope": sma50_slope,
        })
```

Also update the empty-result fallback columns list (two places — search for `"dist_sma50_pct"` and add `"dist_sma20_pct"` alongside it in both):

```python
        cols = [
            "last",
            f"sma{cfg.sma_fast}",
            f"sma{cfg.sma_mid}",
            f"sma{cfg.sma_long}",
            "trend_ok",
            "dist_sma20_pct",
            "dist_sma50_pct",
            "dist_sma200_pct",
        ]
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_trend.py -v
```

Expected: all pass including the new test.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/indicators/trend.py tests/test_trend.py
git commit -m "feat(indicators): add dist_sma20_pct to trend features"
```

---

## Task 3: Extend `Position` and `PositionUpdate` + serialization

**Files:**
- Modify: `src/swing_screener/portfolio/state.py`

- [ ] **Step 1: Write failing test**

Add to `tests/test_portfolio_manage.py`:

```python
def test_position_has_exhaustion_fields():
    from swing_screener.portfolio.state import Position
    pos = Position(
        ticker="AAA", status="open", entry_date="2026-01-01",
        entry_price=100.0, stop_price=90.0, shares=1,
    )
    assert hasattr(pos, "last_exhaustion_score")
    assert hasattr(pos, "last_exhaustion_label")
    assert pos.last_exhaustion_score is None
    assert pos.last_exhaustion_label is None


def test_position_update_has_exhaustion_fields():
    from swing_screener.portfolio.state import PositionUpdate
    u = PositionUpdate(
        ticker="AAA", status="open", last=100.0, entry=95.0,
        stop_old=90.0, stop_suggested=90.0, shares=1,
        r_now=1.0, action="NO_ACTION", reason="test",
    )
    assert hasattr(u, "exhaustion_score")
    assert hasattr(u, "exhaustion_label")
    assert u.exhaustion_score is None
    assert u.exhaustion_label is None
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_portfolio_manage.py::test_position_has_exhaustion_fields tests/test_portfolio_manage.py::test_position_update_has_exhaustion_fields -v
```

Expected: both fail with `TypeError` (unexpected keyword argument) or `AttributeError`.

- [ ] **Step 3: Add fields to `Position` and `PositionUpdate`**

In `src/swing_screener/portfolio/state.py`, at the end of the `Position` dataclass (after `trail_param`):

```python
    last_exhaustion_score: Optional[float] = None
    last_exhaustion_label: Optional[str] = None
```

At the end of the `PositionUpdate` dataclass (after `reason`):

```python
    exhaustion_score: Optional[float] = None
    exhaustion_label: Optional[str] = None
```

- [ ] **Step 4: Update `load_positions`**

In `load_positions`, inside the `Position(...)` constructor call, add after `trail_param`:

```python
                last_exhaustion_score=(
                    float(item["last_exhaustion_score"])
                    if item.get("last_exhaustion_score") is not None
                    else None
                ),
                last_exhaustion_label=item.get("last_exhaustion_label", None),
```

- [ ] **Step 5: Update `save_positions`**

In `save_positions`, inside the position dict in the list comprehension, add after `trail_param`:

```python
                "last_exhaustion_score": pos.last_exhaustion_score,
                "last_exhaustion_label": pos.last_exhaustion_label,
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/test_portfolio_manage.py tests/test_trail_evaluate.py tests/test_scale_in.py tests/test_manage_apply.py -v
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/swing_screener/portfolio/state.py tests/test_portfolio_manage.py
git commit -m "feat(portfolio): add exhaustion fields to Position and PositionUpdate"
```

---

## Task 4: Wire exhaustion into `evaluate_positions`

**Files:**
- Modify: `src/swing_screener/portfolio/state.py`
- Test: `tests/test_exhaustion.py`

- [ ] **Step 1: Write failing integration test**

Add to `tests/test_exhaustion.py`:

```python
def test_evaluate_positions_populates_exhaustion():
    """evaluate_positions populates exhaustion_score and exhaustion_label on PositionUpdate."""
    import pandas as pd
    from swing_screener.portfolio.state import Position, ManageConfig, evaluate_positions

    n = 50
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    closes = [float(100 + i * 0.5) for i in range(n)]  # gently rising
    ticker = "AAA"
    data = {
        ("Close", ticker): closes,
        ("High", ticker): [c + 0.5 for c in closes],
        ("Low", ticker): [c - 0.5 for c in closes],
        ("Volume", ticker): [1000.0] * n,
    }
    ohlcv = pd.DataFrame(data, index=dates)
    ohlcv.columns = pd.MultiIndex.from_tuples(ohlcv.columns)

    pos = Position(
        ticker=ticker, status="open", entry_date="2024-01-01",
        entry_price=100.0, stop_price=90.0, shares=1,
    )
    updates, new_positions = evaluate_positions(ohlcv, [pos], ManageConfig(max_holding_days=0))
    u = updates[0]
    assert u.exhaustion_score is not None
    assert u.exhaustion_label in ("fine", "watch", "exit")
    assert new_positions[0].last_exhaustion_score == u.exhaustion_score
    assert new_positions[0].last_exhaustion_label == u.exhaustion_label
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_exhaustion.py::test_evaluate_positions_populates_exhaustion -v
```

Expected: `AssertionError: assert None is not None`

- [ ] **Step 3: Add `_get_series` helper to `state.py`**

In `src/swing_screener/portfolio/state.py`, right after the `_get_close_series` function, add:

```python
def _get_series(ohlcv: pd.DataFrame, field: str, ticker: str) -> pd.Series:
    """Return (field, ticker) series from OHLCV. Returns empty Series if field/ticker missing."""
    try:
        df = ohlcv[field]
        if ticker not in df.columns:
            return pd.Series(dtype=float)
        return df[ticker].dropna()
    except (KeyError, TypeError):
        return pd.Series(dtype=float)
```

- [ ] **Step 4: Add import and wire into `evaluate_positions`**

At the top of `state.py`, add the import after existing imports:

```python
from swing_screener.indicators.exhaustion import compute_exhaustion_score
```

In `evaluate_positions`, right after `s = _get_close_series(ohlcv, pos.ticker)` and `last = float(s.iloc[-1])`, add:

```python
        exhaustion = compute_exhaustion_score(
            close=s,
            high=_get_series(ohlcv, "High", pos.ticker),
            low=_get_series(ohlcv, "Low", pos.ticker),
            volume=_get_series(ohlcv, "Volume", pos.ticker),
        )
```

- [ ] **Step 5: Populate exhaustion on all `PositionUpdate` construction sites**

There are **four** `PositionUpdate(...)` calls in `evaluate_positions` (stop hit, time exit, exit signal, and the trailing-stop path). Add `exhaustion_score=exhaustion.score, exhaustion_label=exhaustion.label` to each one.

Additionally, each `new_positions.append(Position(**{**pos.__dict__, ...}))` call needs to include `"last_exhaustion_score": exhaustion.score, "last_exhaustion_label": exhaustion.label` in the dict.

The four sites with their surrounding context (find them by their `action=` keyword):

**Site 1** — `action="CLOSE_STOP_HIT"`:
```python
            upd = PositionUpdate(
                ticker=pos.ticker,
                status=pos.status,
                last=last,
                entry=pos.entry_price,
                stop_old=pos.stop_price,
                stop_suggested=pos.stop_price,
                shares=pos.shares,
                r_now=r_now,
                action="CLOSE_STOP_HIT",
                reason="Price <= stop (stop hit)",
                exhaustion_score=exhaustion.score,
                exhaustion_label=exhaustion.label,
            )
            updates.append(upd)
            new_positions.append(
                Position(**{**pos.__dict__, "max_favorable_price": mfp_new,
                            "last_exhaustion_score": exhaustion.score,
                            "last_exhaustion_label": exhaustion.label})
            )
            continue
```

**Site 2** — `action="CLOSE_TIME_EXIT"`:
```python
            upd = PositionUpdate(
                ticker=pos.ticker,
                status=pos.status,
                last=last,
                entry=pos.entry_price,
                stop_old=pos.stop_price,
                stop_suggested=pos.stop_price,
                shares=pos.shares,
                r_now=r_now,
                action="CLOSE_TIME_EXIT",
                reason=f"Time exit: {bars_since} bars since entry_date >= {cfg.max_holding_days}",
                exhaustion_score=exhaustion.score,
                exhaustion_label=exhaustion.label,
            )
            updates.append(upd)
            new_positions.append(
                Position(**{**pos.__dict__, "max_favorable_price": mfp_new,
                            "last_exhaustion_score": exhaustion.score,
                            "last_exhaustion_label": exhaustion.label})
            )
            continue
```

**Site 3** — `action="CLOSE_EXIT_SIGNAL"`:
```python
                updates.append(PositionUpdate(
                    ticker=pos.ticker,
                    status=pos.status,
                    last=last,
                    entry=pos.entry_price,
                    stop_old=pos.stop_price,
                    stop_suggested=pos.stop_price,
                    shares=pos.shares,
                    r_now=float(r_now),
                    action="CLOSE_EXIT_SIGNAL",
                    reason=reason,
                    exhaustion_score=exhaustion.score,
                    exhaustion_label=exhaustion.label,
                ))
                new_positions.append(
                    Position(**{**pos.__dict__, "max_favorable_price": mfp_new,
                                "last_exhaustion_score": exhaustion.score,
                                "last_exhaustion_label": exhaustion.label})
                )
                continue
```

**Site 4** — `action=action` (NO_ACTION / MOVE_STOP_UP at the bottom of the loop):
```python
        updates.append(
            PositionUpdate(
                ticker=pos.ticker,
                status=pos.status,
                last=last,
                entry=pos.entry_price,
                stop_old=stop_old_rounded,
                stop_suggested=stop_suggested_rounded,
                shares=pos.shares,
                r_now=float(r_now),
                action=action,
                reason=reason,
                exhaustion_score=exhaustion.score,
                exhaustion_label=exhaustion.label,
            )
        )

        new_positions.append(
            Position(**{**pos.__dict__, "max_favorable_price": mfp_new,
                        "last_exhaustion_score": exhaustion.score,
                        "last_exhaustion_label": exhaustion.label})
        )
```

- [ ] **Step 6: Run full test suite**

```bash
pytest tests/test_exhaustion.py tests/test_portfolio_manage.py tests/test_trail_evaluate.py -v
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/swing_screener/portfolio/state.py tests/test_exhaustion.py
git commit -m "feat(portfolio): wire exhaustion score into evaluate_positions"
```

---

## Task 5: Add exhaustion to Markdown report

**Files:**
- Modify: `src/swing_screener/portfolio/state.py`

- [ ] **Step 1: Write failing test**

Add to `tests/test_portfolio_manage.py`:

```python
def test_render_degiro_includes_exhaustion():
    from swing_screener.portfolio.state import PositionUpdate, render_degiro_actions_md
    updates = [
        PositionUpdate(
            ticker="AAA", status="open", last=110.0, entry=100.0,
            stop_old=90.0, stop_suggested=100.0, shares=1,
            r_now=1.0, action="MOVE_STOP_UP", reason="breakeven",
            exhaustion_score=7.5, exhaustion_label="exit",
        ),
        PositionUpdate(
            ticker="BBB", status="open", last=105.0, entry=100.0,
            stop_old=90.0, stop_suggested=90.0, shares=1,
            r_now=0.5, action="NO_ACTION", reason="no rule",
            exhaustion_score=2.0, exhaustion_label="fine",
        ),
    ]
    md = render_degiro_actions_md(updates)
    assert "Exhaustion: 7.5 🔴" in md
    assert "Exhaustion: 2.0 🟢" in md
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_portfolio_manage.py::test_render_degiro_includes_exhaustion -v
```

Expected: `AssertionError: assert "Exhaustion: 7.5 🔴" in md`

- [ ] **Step 3: Update `render_degiro_actions_md`**

In `src/swing_screener/portfolio/state.py`, add a helper before `render_degiro_actions_md`:

```python
def _fmt_exhaustion(u: PositionUpdate) -> str:
    if u.exhaustion_score is None:
        return ""
    emoji = {"exit": "🔴", "watch": "🟡", "fine": "🟢"}.get(u.exhaustion_label or "", "🟢")
    return f" | Exhaustion: {u.exhaustion_score:.1f} {emoji} {u.exhaustion_label}"
```

Then in `render_degiro_actions_md`, update the three position-line formatting blocks:

For `MOVE_STOP_UP` lines:
```python
            lines.append(
                f"- **{u.ticker}**: stop {fmt(u.stop_old)} → **{fmt(u.stop_suggested)}** "
                f"(last {fmt(u.last)}, R {fmt_r(u.r_now)}){_fmt_exhaustion(u)}"
            )
```

For `CLOSE_*` lines:
```python
            lines.append(
                f"- **{u.ticker}**: **{u.action}** (last {fmt(u.last)}, stop {fmt(u.stop_old)}, R {fmt_r(u.r_now)}){_fmt_exhaustion(u)}"
            )
```

For `NO_ACTION` lines:
```python
            lines.append(
                f"- **{u.ticker}**: keep stop {fmt(u.stop_old)} (last {fmt(u.last)}, R {fmt_r(u.r_now)}){_fmt_exhaustion(u)}"
            )
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_portfolio_manage.py -v
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/swing_screener/portfolio/state.py tests/test_portfolio_manage.py
git commit -m "feat(portfolio): add exhaustion score to Degiro Markdown report"
```

---

## Task 6: Extend API `PositionUpdate` model

**Files:**
- Modify: `api/models/portfolio.py`
- Modify: `api/services/portfolio_service.py`

- [ ] **Step 1: Write failing test**

Add to `tests/api/` (find an existing API test file for portfolio, e.g. `tests/api/test_portfolio_routes.py`):

```python
def test_position_update_api_model_has_exhaustion_fields():
    from api.models.portfolio import PositionUpdate
    u = PositionUpdate(
        ticker="AAA", status="open", last=110.0, entry=100.0,
        stop_old=90.0, stop_suggested=100.0, shares=1,
        r_now=1.0, action="MOVE_STOP_UP", reason="test",
    )
    assert u.exhaustion_score is None
    assert u.exhaustion_label is None
    u2 = PositionUpdate(
        ticker="AAA", status="open", last=110.0, entry=100.0,
        stop_old=90.0, stop_suggested=100.0, shares=1,
        r_now=1.0, action="MOVE_STOP_UP", reason="test",
        exhaustion_score=5.5, exhaustion_label="watch",
    )
    assert u2.exhaustion_score == 5.5
    assert u2.exhaustion_label == "watch"
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/api/ -k "test_position_update_api_model_has_exhaustion_fields" -v
```

Expected: `TypeError: unexpected keyword argument 'exhaustion_score'`

- [ ] **Step 3: Add fields to `api/models/portfolio.py`**

In `api/models/portfolio.py`, extend the `PositionUpdate` Pydantic model (after `reason: str`):

```python
class PositionUpdate(BaseModel):
    ticker: str
    status: PositionStatus
    last: float
    entry: float
    stop_old: float
    stop_suggested: float
    shares: int
    r_now: float
    action: ActionType
    reason: str
    exhaustion_score: Optional[float] = None
    exhaustion_label: Optional[str] = None
```

- [ ] **Step 4: Pass exhaustion fields in `portfolio_service.py`**

There are **two** `return PositionUpdate(...)` calls — at lines 910 and 993. Add the exhaustion fields to both:

```python
        return PositionUpdate(
            ticker=update.ticker,
            status=update.status,
            last=update.last,
            entry=update.entry,
            stop_old=update.stop_old,
            stop_suggested=update.stop_suggested,
            shares=update.shares,
            r_now=update.r_now,
            action=update.action,
            reason=update.reason,
            exhaustion_score=update.exhaustion_score,
            exhaustion_label=update.exhaustion_label,
        )
```

Apply this change at both sites (line 910 and line 993).

- [ ] **Step 5: Run tests**

```bash
pytest tests/api/ -v
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add api/models/portfolio.py api/services/portfolio_service.py tests/api/
git commit -m "feat(api): expose exhaustion score in PositionUpdate API model"
```

---

## Task 7: Update docs

**Files:**
- Modify: `data/README.md`

- [ ] **Step 1: Add migration note to `data/README.md`**

At the end of the `## positions.json schema notes` section, add:

```markdown
New fields added in exhaustion-score feature:
- `last_exhaustion_score`: `float | null` — composite exhaustion score (0–10) from last `evaluate_positions()` run. Higher = more likely topping out.
- `last_exhaustion_label`: `"fine" | "watch" | "exit" | null` — threshold label for `last_exhaustion_score`.

Both fields are optional. Existing positions without them load with `None` (backward-compatible).
```

- [ ] **Step 2: Run full test suite**

```bash
pytest -q && cd web-ui && npm test
```

Expected: all pass, zero failures.

- [ ] **Step 3: Commit**

```bash
git add data/README.md
git commit -m "docs: add exhaustion score migration note to positions.json schema"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|-----------------|------|
| `ExhaustionResult` dataclass | Task 1 |
| `compute_exhaustion_score()` pure function | Task 1 |
| All 5 signals with correct weights | Task 1 |
| Error handling (try/except per component) | Task 1 |
| `dist_sma20_pct` in trend features | Task 2 |
| `Position.last_exhaustion_score/label` | Task 3 |
| `PositionUpdate.exhaustion_score/label` | Task 3 |
| `load_positions` / `save_positions` serialization | Task 3 |
| `evaluate_positions` wiring | Task 4 |
| `_get_series` helper | Task 4 |
| Markdown renderer with emoji | Task 5 |
| API `PositionUpdate` model fields | Task 6 |
| `portfolio_service` mapping | Task 6 |
| `data/README.md` migration note | Task 7 |

All spec requirements covered.

### No placeholders — verified.

### Type consistency — verified: `ExhaustionResult` defined in Task 1, used in Task 4. `_fmt_exhaustion` uses `PositionUpdate.exhaustion_score/label` defined in Task 3. API model fields match core fields exactly.
