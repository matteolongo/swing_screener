# PR 5 — Richer Technical Readiness Model

> Branch: `feat/richer-technical-model`
> Base: `feature/ux-revamp`
> Depends on: PR4
> Blocks: PR8

---

## Problem

Current ranking uses only three momentum columns (`mom_6m`, `mom_12m`, `rs_6m`). Additional information already computed at universe-build time — SMA levels, ATR, trend direction — is not used in the score.

Consequence:
- Strong but low-quality setups (extended, loose, no volume) can rank as high as clean, tight setups.
- The system underuses available market structure data.
- `technical_readiness` fed into intelligence does not reflect setup quality.

---

## Features to add

### Group A — Momentum enrichment (extends existing `indicators/momentum.py`)

| Column | Formula | Notes |
|---|---|---|
| `sector_rs_6m` | `mom_6m - sector_benchmark_mom_6m` | Requires sector map input; fall back to `rs_6m` if sector unknown |
| `sma20_slope` | `(sma20[t] / sma20[t-20]) - 1` | Trend acceleration — positive means rising trend |
| `sma50_slope` | `(sma50[t] / sma50[t-50]) - 1` | Longer-term trend health |

### Group B — Setup quality (new `indicators/setup_quality.py`)

| Column | Formula | Notes |
|---|---|---|
| `consolidation_tightness` | `1 - (atr14 / atr14_3m)` clamped to [0,1] | Higher = tighter base. `atr14_3m` = 63-bar ATR. |
| `close_location_in_range` | `(close - low_20) / (high_20 - low_20)` clamped | Higher = closing near top of range |
| `above_breakout_extension` | `max(0, (close / high_50) - 1)` | Extension penalty: large value = chasing |

### Group C — Volume confirmation (when volume data available)

| Column | Formula | Notes |
|---|---|---|
| `breakout_volume_confirmation` | `True` if breakout-bar relative volume > 1.5× 20-bar avg | Optional — skip gracefully if volume absent |

---

## Changes

### 1. `src/swing_screener/indicators/momentum.py`

- Add `sector_rs_6m` computation: accepts optional `sector_benchmark_returns: dict[str, float]`.
- Add `sma20_slope` and `sma50_slope`.
- All new columns are additive; existing interface unchanged.

### 2. New file: `src/swing_screener/indicators/setup_quality.py`

```python
def compute_setup_quality(df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds consolidation_tightness, close_location_in_range, above_breakout_extension.
    Requires: close, high, low, atr14. Volume columns optional.
    Missing inputs produce NaN for that column only.
    """
```

### 3. `src/swing_screener/selection/ranking.py` — `RankingConfig` and `compute_hot_score`

Extend `RankingConfig` with optional weights (default 0 = disabled):

```python
@dataclass(frozen=True)
class RankingConfig:
    # existing
    w_mom_6m: float = 0.45
    w_mom_12m: float = 0.35
    w_rs_6m: float = 0.20
    top_n: int = 15
    # new optional weights
    w_setup_quality: float = 0.0
    w_sma20_slope: float = 0.0
    w_sector_rs: float = 0.0
    extension_penalty_cap: float = 0.10  # max score reduction from extension
```

In `compute_hot_score`:
- For each new weight > 0, add the corresponding percentile rank term.
- `above_breakout_extension` is inverted (higher extension → lower percentile).
- New columns are silently skipped if absent from the DataFrame.

### 4. `src/swing_screener/selection/entries.py`

Add `breakout_volume_confirmation` column to `build_signal_board()` output:
- `True` if volume at breakout bar > 1.5× 20-bar avg volume.
- `None` / `NaN` if volume column is absent.

### 5. `src/swing_screener/recommendation/decision_summary.py`

Expose setup quality features in `ExplanationContract.why_it_qualified`:
- "Tight consolidation base" if `consolidation_tightness > 0.7`
- "Volume-confirmed breakout" if `breakout_volume_confirmation == True`
- "Extended — avoid chasing" warning if `above_breakout_extension > 0.05`

---

## Tests

### `tests/test_setup_quality.py` (new)

**Test 1 — tight base scores higher than loose base**
```python
def test_tight_consolidation_scores_higher():
    tight = df_with_atr(current=1.0, historical=2.0)   # atr14 < atr14_3m
    loose = df_with_atr(current=2.0, historical=2.0)
    assert compute_setup_quality(tight)["consolidation_tightness"].iloc[0] > \
           compute_setup_quality(loose)["consolidation_tightness"].iloc[0]
```

**Test 2 — missing volume produces NaN, no crash**
```python
def test_missing_volume_produces_nan():
    df = df_without_volume_column()
    result = compute_setup_quality(df)
    # breakout_volume_confirmation should be absent or NaN, not raise
    assert "breakout_volume_confirmation" not in result.columns or \
           result["breakout_volume_confirmation"].isna().all()
```

**Test 3 — new ranking columns optional and backward compatible**
```python
def test_ranking_without_new_columns_unchanged():
    df = standard_three_column_df()
    cfg_old = RankingConfig()    # all new weights = 0
    cfg_new = RankingConfig(w_setup_quality=0.1, w_sma20_slope=0.1)
    result_old = compute_hot_score(df, cfg_old)
    # Old config must produce same order as current implementation
    assert list(result_old.index) == expected_order
```

**Test 4 — extension penalty reduces score for extended candidate**
```python
def test_extension_penalty_reduces_score():
    extended = df_with_extension(0.15)    # 15% above 50-bar high
    not_extended = df_with_extension(0.0)
    cfg = RankingConfig(extension_penalty_cap=0.10)
    assert compute_hot_score(not_extended, cfg)["score"].iloc[0] > \
           compute_hot_score(extended, cfg)["score"].iloc[0]
```

---

## Acceptance criteria

- [ ] `consolidation_tightness`, `close_location_in_range`, `above_breakout_extension` are computed and present on candidates.
- [ ] `sma20_slope`, `sma50_slope` are computed when SMA data is available.
- [ ] New ranking columns are opt-in via `RankingConfig`; old tests pass unchanged.
- [ ] `decision_summary` explanation notes "tight base", "volume confirmed", or "extended" where appropriate.
- [ ] All four new tests pass.
