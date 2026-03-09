# Selection Module

Stock screening pipeline: universe filtering → momentum ranking → entry signal detection.

## Quick Start

```python
from swing_screener.selection.pipeline import build_selection_pipeline
from swing_screener.selection.universe import UniverseConfig
from swing_screener.selection.ranking import RankingConfig
from swing_screener.selection.entries import EntrySignalConfig

result = build_selection_pipeline(
    ohlcv,
    universe_cfg=UniverseConfig(),
    ranking_cfg=RankingConfig(),
    entry_cfg=EntrySignalConfig(),
    exclude_tickers=["UVXY", "SQQQ"],  # optional
)

print(result.ranked)   # top-N candidates with momentum scores
print(result.board)    # entry signals per candidate
```

## Pipeline Stages

```
OHLCV
  │
  ▼
build_feature_table()     ← joins trend + volatility + momentum indicators
  │
  ▼
apply_universe_filters()  ← min/max price, ATR%, trend alignment, currency
  │
  ▼
eligible_universe()       ← returns only is_eligible == True tickers
  │
  ▼
top_candidates()          ← weighted percentile ranking → top N by score
  │
  ▼
build_signal_board()      ← breakout and/or pullback signal per ticker
  │
  ▼
SelectionResult(universe, ranked, board)
```

## Files

| File | Purpose |
|------|---------|
| `pipeline.py` | `build_selection_pipeline()` — top-level coordinator |
| `universe.py` | Feature table construction and universe filtering |
| `ranking.py` | Weighted momentum score (`compute_hot_score`, `top_candidates`) |
| `entries.py` | Entry signal detection (`breakout_signal`, `pullback_reclaim_signal`) |
| `__init__.py` | Package exports |

## Configuration

### `UniverseConfig`
Wraps the three indicator configs plus filter config:
```python
@dataclass(frozen=True)
class UniverseConfig:
    trend: TrendConfig          = TrendConfig()
    vol:   VolatilityConfig     = VolatilityConfig(atr_window=14)
    mom:   MomentumConfig       = MomentumConfig(benchmark="SPY")
    filt:  UniverseFilterConfig = UniverseFilterConfig()
```

### `UniverseFilterConfig`
```python
@dataclass(frozen=True)
class UniverseFilterConfig:
    min_price:         float     = 10.0     # minimum last close price
    max_price:         float     = 60.0     # maximum last close price
    max_atr_pct:       float     = 10.0     # max ATR% (volatility cap)
    require_trend_ok:  bool      = True     # must be above SMA200 in uptrend
    require_rs_positive: bool    = False    # require positive 6m relative strength
    currencies:        list[str] = ["USD", "EUR"]
```

The filter adds `is_eligible` (bool) and `reason` (string) columns to the feature table.

### `RankingConfig`
```python
@dataclass(frozen=True)
class RankingConfig:
    w_mom_6m:  float = 0.45   # weight for 6-month momentum percentile rank
    w_mom_12m: float = 0.35   # weight for 12-month momentum percentile rank
    w_rs_6m:   float = 0.20   # weight for 6-month relative strength percentile rank
    top_n:     int   = 15     # maximum candidates returned
```

`score` = weighted sum of percentile ranks (0–1, higher = stronger momentum).

### `EntrySignalConfig`
```python
@dataclass(frozen=True)
class EntrySignalConfig:
    breakout_lookback: int = 50    # bars: close > max(close[-50:-1])
    pullback_ma:       int = 20    # bars: SMA20 for pullback-reclaim
    min_history:       int = 260   # minimum bars of history required (~1 year)
```

Signal values: `"breakout"`, `"pullback"`, `"both"`, `"none"`.

## Output

`SelectionResult` has three DataFrames:

| Attribute | Description |
|-----------|-------------|
| `universe` | All eligible tickers with features and filter details |
| `ranked` | Top-N tickers with `score` and `rank` columns |
| `board` | Entry signals: `signal`, `last`, `breakout_level`, `ma20_level` |

## See Also

- `indicators/` — trend, momentum, volatility computation
- `risk/position_sizing.py` — `build_trade_plans()` takes `ranked` + `board`
- `strategy/modules/momentum.py` — full strategy using this pipeline
