# Strategy Module

Strategy framework: plugin-based architecture, module registry, configuration persistence, and orchestration.

## Quick Start

```python
from swing_screener.strategy.orchestrator import build_strategy_report
from swing_screener.strategy.report_config import ReportConfig

# Build the daily report using the active strategy
report = build_strategy_report(ohlcv, cfg=ReportConfig())
```

```python
from swing_screener.strategy.storage import get_active_strategy, load_strategies

# Inspect current strategy configuration
strategy = get_active_strategy()
print(strategy["id"], strategy.get("risk", {}))
```

## Architecture

```
strategy/
  orchestrator.py     ← entry point: dispatches to a StrategyModule
  registry.py         ← module registry (name → StrategyModule)
  base.py             ← StrategyModule Protocol definition
  modules/
    momentum.py       ← built-in momentum strategy (default)
  plugins/            ← 18 pluggable feature modules
  plugin_system.py    ← plugin resolution and config merging
  config.py           ← builder functions for all config dataclasses
  report_config.py    ← ReportConfig aggregator
  storage.py          ← strategy persistence (config/strategies.yaml)
```

## StrategyModule Protocol

Any strategy module must implement:
```python
class StrategyModule(Protocol):
    name: str

    def build_report(
        self,
        ohlcv: pd.DataFrame,
        cfg: ReportConfig,
        exclude_tickers: Iterable[str] | None = None,
    ) -> pd.DataFrame: ...
```

The default module is `MomentumStrategyModule` (registered as `"momentum"`).

## Plugin System

Plugins are self-contained feature modules in `strategy/plugins/`. Each plugin can be enabled/disabled and configured per strategy. The 18 available plugins:

| Plugin | Purpose |
|--------|---------|
| `atr_filter` | Filter candidates by ATR% volatility cap |
| `atr_position_sizing` | Size positions using ATR-based stops |
| `breakeven_management` | Move stop to breakeven after 1R gain |
| `breakout_signal` | Detect 50-bar price breakouts |
| `currency_filter` | Filter by ticker currency (USD/EUR) |
| `fee_gate` | Skip trades where fees exceed risk budget |
| `market_intelligence` | Overlay catalyst/event scoring |
| `min_history_gate` | Require minimum bars of history |
| `momentum_ranking` | Rank by 6m/12m momentum + relative strength |
| `price_filter` | Filter by min/max last price |
| `pullback_signal` | Detect SMA20 pullback-reclaim entries |
| `regime_risk` | Scale down risk in bear/high-vol regimes |
| `rr_gate` | Require minimum reward-to-risk ratio |
| `rs_filter` | Require positive relative strength |
| `social_overlay` | Sentiment/attention-based veto |
| `time_exit_management` | Exit after max holding days |
| `trailing_management` | Trail stop under SMA after 2R gain |
| `trend_filter` | Require price above SMA200 in uptrend |
| `volume_confirmation` | (reserved) |

## Configuration

### `ReportConfig`
Central config aggregator — passed to `build_strategy_report()`:
```python
from swing_screener.strategy.report_config import ReportConfig

cfg = ReportConfig(
    strategy_module="momentum",   # which StrategyModule to use
    universe=UniverseConfig(),
    ranking=RankingConfig(),
    entry=EntrySignalConfig(),
    risk=RiskConfig(account_size=50_000, risk_pct=0.01),
    manage=ManageConfig(),
)
```

### Strategy Storage

Strategies are persisted to `config/strategies.yaml`, which also stores `active_strategy_id`.

```python
from swing_screener.strategy.storage import (
    load_strategies,         # list all saved strategies
    save_strategies,         # persist strategies
    get_active_strategy,     # → dict of active strategy config
    set_active_strategy_id,  # change active strategy
)
```

Default strategy ID: `"default"`.

### Legacy Migration

`storage.py` includes a one-time migration: if a strategy has a `backtest` config key (old format), it is automatically promoted to a `risk` key on first load. No new code should use the `backtest` key.

## Builder Functions (`config.py`)

Convenience builders that construct typed config dataclasses from a raw strategy dict:
- `build_universe_config(strategy_dict)` → `UniverseConfig`
- `build_ranking_config(strategy_dict)` → `RankingConfig`
- `build_entry_config(strategy_dict)` → `EntrySignalConfig`
- `build_risk_config(strategy_dict)` → `RiskConfig`
- `build_manage_config(strategy_dict)` → `ManageConfig`
- `build_social_overlay_config(strategy_dict)` → `SocialOverlayConfig`
- `build_report_config(strategy_dict)` → `ReportConfig`

## Adding a Custom Strategy Module

```python
from swing_screener.strategy.registry import register
from swing_screener.strategy.base import StrategyModule

class MyStrategyModule:
    name = "my_strategy"

    def build_report(self, ohlcv, cfg, exclude_tickers=None):
        # ... custom logic ...
        return pd.DataFrame(...)

register(MyStrategyModule())
```

## See Also

- `selection/pipeline.py` — used by `MomentumStrategyModule`
- `risk/position_sizing.py` — `build_trade_plans()`
- `reporting/report.py` — `build_daily_report()` thin wrapper
- `execution/guidance.py` — execution guidance columns added to report
- `social/analysis.py` — social overlay integration
- `intelligence/pipeline.py` — market intelligence integration
