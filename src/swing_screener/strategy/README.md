# Strategy Module

Strategy configuration, persistence, and the momentum report builder.

## Quick Start

```python
from swing_screener.strategy.modules.momentum import build_strategy_report
from swing_screener.strategy.report_config import ReportConfig

# Build the daily report using the active strategy
report = build_strategy_report(ohlcv, cfg=ReportConfig())
```

The optional `market_phase` argument is part of the momentum evaluation-cache
identity. The screener service supplies its resolved freshness phase; callers
that do not classify the session use the conservative `unknown` default.

```python
from swing_screener.strategy.storage import get_active_strategy, load_strategies

# Inspect current strategy configuration
strategy = get_active_strategy()
print(strategy["id"], strategy.get("risk", {}))
```

## Architecture

```
strategy/
  modules/
    momentum.py       ← build_strategy_report(): the only report builder
  config.py           ← builder functions for all config dataclasses
  report_config.py    ← ReportConfig aggregator
  storage.py          ← strategy persistence (config/strategies.yaml)
  validation.py       ← strategy safety/consistency checks
```

`build_strategy_report()` reuses cached per-symbol records when given an
evaluation cache and an `asof_date`, then calls `build_momentum_report()`. The
strategy `module` field stored in `config/strategies.yaml` is kept for
compatibility; `momentum` is the only builder.

## Configuration

### `ReportConfig`
Central config aggregator — passed to `build_strategy_report()`:
```python
from swing_screener.strategy.report_config import ReportConfig

cfg = ReportConfig(
    universe=UniverseConfig(),
    ranking=RankingConfig(),
    entry=EntrySignalConfig(),
    risk=RiskConfig(account_size=50_000, risk_pct=0.01),
    execution=ExecutionConfig(),
    manage=ManageConfig(),
)
```

Omitted configs are created at call time. One `ReportConfig.execution` instance
is shared by momentum guidance and API pattern-stop evaluation for the request.

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
- `build_report_config(strategy_dict)` → `ReportConfig`

`build_report_config()` is the sole report-config assembly path, including API
request and regime overrides. Its optional typed overrides preserve all other
configured fields. `ReportConfig.confidence` is loaded from
`low_level.reporting.confidence` and participates in report generation and
evaluation-cache identity.

## See Also

- `selection/pipeline.py` — used by `build_momentum_report()`
- `risk/position_sizing.py` — `build_trade_plans()`
- `reporting/report.py` — `build_daily_report()` thin wrapper
- `execution/guidance.py` — execution guidance columns added to report
- `intelligence/pipeline.py` — market intelligence integration
