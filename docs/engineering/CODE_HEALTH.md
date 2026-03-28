# Code Health Report

Analysis of hardcoded values, unused code, and technical debt in `src/swing_screener/`.

Last reviewed: 2026-03-08.

---

## 1. Removed: Empty Placeholder Directories

The following directories were **removed** as they contained no code, no imports, and no active references anywhere in the codebase. Their responsibilities were absorbed by other modules during prior refactors.

| Removed | Replaced by |
|---------|------------|
| `signals/` | `selection/entries.py` — breakout/pullback signal detection |
| `screeners/` | `selection/pipeline.py` — unified screening pipeline |
| `backtest/` | (not yet implemented; see ROADMAP.md) |
| `recommendations/` | `risk/engine.py` — trade thesis and recommendation logic |
| `strategies/` | `strategy/` — strategy module system |

---

## 2. Orphaned Code

### `db.py` — Unused SQLAlchemy ORM
**Status**: Orphaned. The ORM models (`PositionModel`, `OrderModel`, `Database`) are defined but never imported or used.

**Context**: The CLI uses `data/positions.json` and `data/orders.json` as the single source of truth (with `portalocker` file locking). The SQLAlchemy layer was an earlier design that was superseded.

**Recommendation**: Keep as reserved infrastructure for a future relational storage layer, or remove if no migration is planned. Do not use it for new features without first integrating it with the JSON persistence layer.

---

### `data/market_data.py` — Backward-Compatibility Wrapper
**Status**: Intentional, but legacy.

`fetch_ohlcv()` in this file is a thin wrapper around `get_market_data_provider()`. It exists to avoid breaking older call sites.

**Recommendation**: New code should call `get_market_data_provider()` directly from `data/providers/factory.py`. `market_data.py` can be deprecated once all internal callers are updated.

---

### `strategy/storage.py` — Legacy Config Migration
**Status**: Intentional, functional.

`load_strategies()` includes a one-time migration that promotes the old `backtest` config key to the new `risk` key. This runs transparently on every load until all stored strategies have been migrated.

**Recommendation**: Keep until all production strategy files are confirmed to use the `risk` key. No new code should write the `backtest` key.

---

## 3. Hardcoded Values Inventory

### 🔴 High Impact — Review Before Production Use

| File | Symbol | Value | Note |
|------|--------|-------|------|
| `risk/position_sizing.py` | `RiskConfig.account_size` | `500.0` | ⚠ Minimal default (€500). Always override with actual account size in strategy config. |

---

### 🟡 Medium Impact — Sensible Defaults, Configurable Per Strategy

All values below are `dataclass` defaults. They can be overridden via `RiskConfig`, `UniverseFilterConfig`, `RankingConfig`, etc. — either in code or through the strategy config stored in `config/strategies.yaml`.

| File | Symbol | Value | Context |
|------|--------|-------|---------|
| `risk/position_sizing.py` | `risk_pct` | `0.01` | 1% risk per trade |
| `risk/position_sizing.py` | `k_atr` | `2.0` | Stop = entry − 2×ATR14 |
| `risk/position_sizing.py` | `max_position_pct` | `0.60` | Max 60% of account in one position |
| `risk/position_sizing.py` | `min_rr` | `2.0` | Minimum reward-to-risk ratio (fee gate) |
| `risk/position_sizing.py` | `regime_vol_atr_pct_threshold` | `6.0` | ATR% above this triggers high-vol regime |
| `selection/universe.py` | `UniverseFilterConfig.min_price` | `10.0` | Minimum last close price |
| `selection/universe.py` | `UniverseFilterConfig.max_price` | `60.0` | Maximum last close price |
| `selection/universe.py` | `UniverseFilterConfig.max_atr_pct` | `10.0` | Maximum ATR% (volatility cap) |
| `selection/ranking.py` | `RankingConfig.top_n` | `15` | Top-N candidates from ranking |
| `selection/ranking.py` | `w_mom_6m / w_mom_12m / w_rs_6m` | `0.45 / 0.35 / 0.20` | Momentum ranking weights |
| `selection/entries.py` | `EntrySignalConfig.breakout_lookback` | `50` | Bars for 50-bar breakout detection |
| `selection/entries.py` | `EntrySignalConfig.pullback_ma` | `20` | SMA window for pullback-reclaim |
| `selection/entries.py` | `EntrySignalConfig.min_history` | `260` | Minimum bars required (~1 trading year) |
| `portfolio/state.py` | `ManageConfig.breakeven_at_R` | `1.0` | Move stop to entry when 1R gained |
| `portfolio/state.py` | `ManageConfig.trail_after_R` | `2.0` | Begin trailing stop after 2R gained |
| `portfolio/state.py` | `ManageConfig.trail_sma` | `20` | SMA window for trailing stop |
| `portfolio/state.py` | `ManageConfig.sma_buffer_pct` | `0.005` | Trail 0.5% below SMA |
| `portfolio/state.py` | `ManageConfig.max_holding_days` | `20` | Time exit after 20 calendar days |
| `indicators/trend.py` | `TrendConfig.sma_fast/mid/long` | `20 / 50 / 200` | Standard SMA windows |
| `indicators/momentum.py` | `MomentumConfig.lookback_6m/12m` | `126 / 252` | Trading days for 6m and 12m lookback |
| `indicators/volatility.py` | `VolatilityConfig.atr_window` | `14` | ATR period (standard Wilder ATR14) |
| `execution/guidance.py` | `breakout_stop_buffer_pct` | `0.002` | 0.2% stop buffer below breakout level |
| `execution/guidance.py` | `pullback_atr_fraction` | `0.25` | Limit order 0.25×ATR below current |

---

### 🟢 Low Impact — Infrastructure Defaults (Unlikely to Need Change)

| File | Symbol | Value | Context |
|------|--------|-------|---------|
| `utils/file_lock.py` | `DEFAULT_TIMEOUT` | `5.0` | File lock timeout in seconds |
| `reporting/report.py` | `export_path` | `"out/daily_report.csv"` | Default CSV export path |

---

## 4. Code Quality Notes

The following are observed strengths that should be preserved:

- ✅ **No wildcard imports** — all imports are explicit
- ✅ **Frozen dataclasses** for all config objects — prevents mutation bugs
- ✅ **Protocol-based abstractions** — `StrategyModule`, `MarketDataProvider`, `IngestionProvider`
- ✅ **File locking** via `portalocker` — safe concurrent CLI access
- ✅ **JSON persistence** — simple, debuggable, diffable
- ✅ **Sparse calendar handling** — indicators compute per-ticker on actual trading days, not calendar days
- ✅ **Type hints** on public APIs across all modules

---

## 5. Module Documentation Status

| Module | README | Notes |
|--------|--------|-------|
| `data/` | ✅ Updated | Provider env vars, caching, universe API |
| `indicators/` | ✅ Created | All three indicators documented |
| `selection/` | ✅ Created | Full pipeline with config reference |
| `risk/` | ✅ Updated | Full `RiskConfig` parameter table |
| `execution/` | ✅ Updated | DeGiro fees, order lifecycle, files list |
| `portfolio/` | ✅ Created | Position, ManageConfig, metrics |
| `reporting/` | ✅ Created | All functions, notes on defaults |
| `strategy/` | ✅ Created | Plugin system and config reference |
| `intelligence/` | ✅ Updated | LLM providers, ingestion sources |
| `utils/` | ✅ Created | All helpers documented |
