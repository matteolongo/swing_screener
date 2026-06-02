# Exhaustion Score — Design Spec

**Date:** 2026-06-02  
**Branch:** feature/exhaustion-score (TBD)  
**Status:** approved, pending implementation plan

---

## Problem

The existing `CLOSE_EXIT_SIGNAL` (N consecutive closes below SMA20) fires too late — price has already given back meaningful R by the time the signal triggers. No leading signal exists to warn that a trend is likely topping out.

## Goal

Add a composite **exhaustion score (0–10)** per open position to the existing `positions review` EOD report. Advisory-only (no new action type). Designed to be run manually at any point during market hours, using daily OHLCV data already in the cache.

---

## Architecture

### New module: `src/swing_screener/indicators/exhaustion.py`

Single pure function:

```python
def compute_exhaustion_score(
    close: pd.Series,
    high: pd.Series,
    low: pd.Series,
    volume: pd.Series,
) -> ExhaustionResult
```

```python
@dataclass(frozen=True)
class ExhaustionResult:
    score: float              # 0–10
    label: str                # "fine" | "watch" | "exit"
    components: dict[str, float]  # per-signal breakdown (nan = insufficient data)
```

No side effects. No state. No external calls.

### Changes to existing code

**`src/swing_screener/indicators/trend.py`**  
Add `dist_sma20_pct` to `compute_trend_features()` output (same pattern as existing `dist_sma50_pct`).

**`src/swing_screener/portfolio/state.py`**  
- `Position` dataclass: add `last_exhaustion_score: float | None = None`, `last_exhaustion_label: str | None = None`
- `PositionUpdate` dataclass: add `exhaustion_score: float | None = None`, `exhaustion_label: str | None = None`
- `evaluate_positions()`: call `compute_exhaustion_score()` for each open position; populate both `PositionUpdate` fields and update `Position.last_exhaustion_score/label` (persisted via `save_positions`)
- `render_degiro_actions_md()`: append `| Exhaustion: {score:.1f} {emoji}` to each position line
- `load_positions()` / `save_positions()`: serialize/deserialize the two new `Position` fields

**`data/README.md`**  
Migration note: two new optional fields added to each position object in `positions.json`.

---

## Signal Components

Five signals, each normalized to [0, 1], combined as weighted sum → [0, 10].

| Signal | Weight | Detects | Formula |
|--------|--------|---------|---------|
| `ext_sma20` | 2.5 | Price ran too far from mean | `dist_sma20_pct`: 0 below 3%, 1.0 at ≥15% (linear) |
| `slope_sma20` | 2.0 | Mean losing upward momentum | `sma20_slope` (already in trend features): negative→1.0, flat (<0.001)→0.5, positive→0 |
| `vol_distribution` | 2.0 | No new buyers at highs | 3-day avg vol / 20-day avg vol: score 1.0 if ratio <0.7 AND dist_sma20 >5%; else scaled linearly |
| `range_decay` | 2.0 | Price failing to hold upper range | `close_location_in_range`: score 0 at ≥0.8, 1.0 at ≤0.3 (linear) |
| `rsi_overbought` | 1.5 | Overbought momentum | 14-period RSI from close: 0 below 65, 1.0 at ≥80 (linear) |

**Thresholds:**

| Score | Label | Emoji |
|-------|-------|-------|
| < 4.0 | fine  | 🟢 |
| 4.0–6.9 | watch | 🟡 |
| ≥ 7.0 | exit  | 🔴 |

---

## Data Flow

```
evaluate_positions(ohlcv, positions, cfg)
  └─ for each open position:
       1. existing logic (stop hit, time exit, SMA breach, trailing stop)
       2. compute_exhaustion_score(close_series, high_series, low_series, vol_series)
       3. populate PositionUpdate.exhaustion_score / .exhaustion_label
       4. update Position.last_exhaustion_score / .last_exhaustion_label
```

All series extracted from `ohlcv` using the same `_get_close_series()` pattern already in `portfolio/state.py`. If ticker missing or data insufficient for a component, that component contributes 0 (never raises, never skips the position).

### Report output (per position line)

```
- **AAPL**: stop 182.00 → 185.50 (last 191.20, R +2.1R) | Exhaustion: 7.3 🔴 exit
- **MSFT**: keep stop 410.00 (last 415.00, R +0.8R)     | Exhaustion: 2.1 🟢 fine
```

---

## Error Handling

- Each of the five signal computations is wrapped in `try/except`.
- Any failure (insufficient bars, missing field, zero division) → component value set to `nan` in `ExhaustionResult.components`, contributes 0 to score.
- Score is valid for remaining components. Position always appears in the report.
- Minimum data requirement: 20 bars needed for range_decay and vol_distribution; 14+1 bars for RSI; SMA20 window for ext_sma20 and slope_sma20. Below minimum → component = nan.

---

## Persistence

`last_exhaustion_score` and `last_exhaustion_label` are written back to `positions.json` after each `evaluate_positions()` call. This allows tracking exhaustion trend over multiple runs (e.g., score rising from 3 → 5 → 7 across days signals accelerating deterioration).

Fields are optional in the schema — existing positions without them load fine (default `None`).

---

## Testing

File: `tests/test_exhaustion.py`

- Each signal independently: synthetic series designed to maximally trigger it, verify component near 1.0
- Score thresholds: boundary values around 4.0 and 7.0
- Insufficient data: <20 bars → all components nan, score 0, label "fine"
- Error resilience: missing volume column → vol_distribution = nan, others unaffected
- Integration: synthetic OHLCV + `Position` through `evaluate_positions()` → `PositionUpdate.exhaustion_score` and `.exhaustion_label` populated

---

## Non-goals

- No new CLI command
- No new data source (daily OHLCV only)
- No intraday minute/tick data
- No ML or curve-fitting
- No automatic exit action (advisory only — `CLOSE_EXHAUSTION` action type is a follow-up, after thresholds are validated against real outcomes)
- No backtest infrastructure

---

## Open questions resolved

- Emoji labels in report output: yes (🟢/🟡/🔴)
- Persist score to `positions.json`: yes (`last_exhaustion_score`, `last_exhaustion_label`)
