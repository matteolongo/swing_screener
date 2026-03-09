# Indicators Module

Technical indicator computation for trend, momentum, and volatility analysis.

## Quick Start

```python
from swing_screener.indicators.trend import TrendConfig, compute_trend_features
from swing_screener.indicators.momentum import MomentumConfig, compute_momentum_features
from swing_screener.indicators.volatility import VolatilityConfig, compute_volatility_features

# ohlcv: MultiIndex DataFrame (field, ticker) — standard format across the project
trend_df = compute_trend_features(ohlcv, TrendConfig())
mom_df   = compute_momentum_features(ohlcv, MomentumConfig())
vol_df   = compute_volatility_features(ohlcv, VolatilityConfig())
```

## Key Concepts

All functions operate on **OHLCV MultiIndex DataFrames** with `(field, ticker)` columns and date index. Indicators are computed **per ticker on its own trading days**, correctly handling sparse calendars (e.g., EUR tickers with different holidays than USD tickers).

Each function returns a `ticker`-indexed DataFrame with named feature columns ready to be joined into a feature table.

## Files

| File | Purpose |
|------|---------|
| `trend.py` | SMA-based trend detection (SMA20/50/200, trend_ok flag) |
| `momentum.py` | Price momentum over 6m and 12m; relative strength vs benchmark |
| `volatility.py` | ATR14 and ATR% using Wilder's smoothing |

## Configuration

### `TrendConfig`
```python
@dataclass(frozen=True)
class TrendConfig:
    sma_fast: int = 20   # short-term SMA
    sma_mid:  int = 50   # medium-term SMA
    sma_long: int = 200  # long-term trend SMA
```

Output columns: `last`, `sma20`, `sma50`, `sma200`, `trend_ok`, `dist_sma50_pct`, `dist_sma200_pct`

`trend_ok = True` when `last > sma200 AND sma50 > sma200`.

### `MomentumConfig`
```python
@dataclass(frozen=True)
class MomentumConfig:
    lookback_6m:  int = 126   # ~6 months of trading days
    lookback_12m: int = 252   # ~12 months of trading days
    benchmark:    str = "SPY" # relative strength benchmark
```

Output columns: `mom_6m`, `mom_12m`, `rs_6m`

`rs_6m = mom_6m - benchmark_mom_6m` (excess return vs SPY over 6 months).
Benchmark is removed from the output index.

### `VolatilityConfig`
```python
@dataclass(frozen=True)
class VolatilityConfig:
    atr_window: int = 14  # ATR period (standard Wilder ATR14)
```

Output columns: `atr14`, `atr_pct`

`atr_pct = atr14 / last_close * 100` — used by universe filters to cap volatility.

## Notes

- Tickers with insufficient history are silently dropped from the output (not an error).
- `compute_atr()` in `volatility.py` is a legacy matrix-based implementation kept for backward compatibility; prefer `compute_atr_per_ticker()` for sparse calendar correctness.
- The `sma()` helper in `dataframe_helpers.py` is also available for use in signal detection.

## See Also

- `selection/universe.py` — `build_feature_table()` joins all three indicator outputs
- `risk/regime.py` — uses ATR% for regime detection
- `selection/entries.py` — uses SMA for pullback-reclaim signal
