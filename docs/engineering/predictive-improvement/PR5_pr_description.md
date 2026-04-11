# PR 5 — Richer Technical Readiness Model

**Title:** `feat: richer technical model — setup quality, SMA slopes, volume confirmation`

**Branch:** `feat/richer-technical-model` → `feature/ux-revamp`

---

## Summary

- Adds per-ticker setup quality metrics: `consolidation_tightness`, `close_location_in_range`, `above_breakout_extension`, `breakout_volume_confirmation`
- Adds `sma20_slope` and `sma50_slope` (trend acceleration) to the pipeline
- Adds optional `sector_rs_6m` support to momentum features
- Extends `RankingConfig` with opt-in weights (`w_setup_quality`, `w_sma20_slope`, `w_sector_rs`, `extension_penalty_cap`) — all default to 0 (backward-compatible)
- Extension penalty directly reduces score for extended candidates
- Decision summary drivers now surface "Tight consolidation base", "Volume-confirmed breakout", and "Extended — avoid chasing" when appropriate

## Problem solved

Three momentum columns (`mom_6m`, `mom_12m`, `rs_6m`) dominated ranking but ignored setup quality signals already computable from available OHLCV data. Strong but extended/loose setups ranked as high as clean, tight ones.

## Changes

**`src/swing_screener/indicators/setup_quality.py`** (new)
- `compute_setup_quality(ohlcv, tickers)`: computes `consolidation_tightness` (ATR14 vs ATR63 contraction), `close_location_in_range` (position in 20-bar range), `above_breakout_extension` (% above 50-bar prior high), optional `breakout_volume_confirmation` (volume > 1.5× 20-bar avg). Missing inputs produce NaN; never raises.

**`src/swing_screener/indicators/trend.py`**
- `compute_trend_features` now emits `sma20_slope` and `sma50_slope` per ticker

**`src/swing_screener/indicators/momentum.py`**
- `compute_momentum_features` now accepts optional `sector_benchmark_returns` dict; adds `sector_rs_6m` column (falls back to `rs_6m` when sector data is absent)

**`src/swing_screener/selection/ranking.py`**
- `RankingConfig`: new fields `w_setup_quality`, `w_sma20_slope`, `w_sector_rs`, `extension_penalty_cap` (all default to 0.0/0.10)
- `compute_hot_score`: adds weighted percentile rank terms for each enabled new column; applies `above_breakout_extension` as a direct score penalty capped at `extension_penalty_cap`
- Added `normalize_technical_score(df)` helper (for combined priority stage)

**`src/swing_screener/selection/entries.py`**
- `build_signal_board`: adds `breakout_volume_confirmation` when volume data is present in OHLCV

**`src/swing_screener/strategy/modules/momentum.py`**
- Calls `compute_setup_quality` after signal board; joins to report; exposes all new columns in `keep` list

**`api/models/screener.py`**
- Added `sma20_slope`, `sma50_slope`, `consolidation_tightness`, `close_location_in_range`, `above_breakout_extension`, `breakout_volume_confirmation` to `ScreenerCandidate`

**`api/services/screener_service.py`**
- Maps all new columns when building `ScreenerCandidate` from report row

**`src/swing_screener/recommendation/decision_summary.py`**
- `_drivers()` checks `consolidation_tightness > 0.7` → "Tight consolidation base." positive
- `_drivers()` checks `breakout_volume_confirmation is True` → "Volume-confirmed breakout." positive
- `_drivers()` checks `above_breakout_extension > 0.05` → "Extended — avoid chasing at current levels." warning

## Tests

4 new tests in `tests/test_setup_quality.py`:
- `test_tight_consolidation_scores_higher` — tight-base stock has higher `consolidation_tightness`
- `test_missing_volume_produces_nan_no_crash` — graceful handling of absent volume
- `test_ranking_without_new_columns_unchanged` — zero weights preserve existing ordering
- `test_extension_penalty_reduces_score` — extended candidate scores lower than identical clean candidate

All 552 backend tests pass.

## Part of

Predictive & Explanation Improvement Plan — PR5 of 8
Base branch: `feature/ux-revamp`
Can run in parallel with PR6 and PR7 once PR4 is merged.
