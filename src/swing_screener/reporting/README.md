# Reporting Module

Daily trade report generation: consolidates screener output, risk sizing, and execution guidance into a human-readable format.

## Quick Start

```python
from swing_screener.reporting.report import build_daily_report, export_report_csv, today_actions
from swing_screener.strategy.report_config import ReportConfig

# Build the daily report (runs full strategy pipeline)
report = build_daily_report(ohlcv, cfg=ReportConfig())

# Export to CSV
path = export_report_csv(report, path="out/daily_report.csv")

# Print human-friendly summary
print(today_actions(report))
```

```python
from swing_screener.reporting.concentration import sector_concentration_warnings

warnings = sector_concentration_warnings(
    tickers=report.index.tolist(),
    sector_map={"AAPL": "Technology", "MSFT": "Technology", "JPM": "Financials"},
    threshold=0.4,  # warn if any sector > 40% of candidates
)
for w in warnings:
    print(w)
```

## Files

| File | Purpose |
|------|---------|
| `report.py` | `build_daily_report()`, `export_report_csv()`, `today_actions()` |
| `concentration.py` | `sector_concentration_warnings()` — detect sector imbalance |
| `__init__.py` | Package exports |

## Functions

### `build_daily_report(ohlcv, cfg, exclude_tickers)`
Delegates to `strategy.orchestrator.build_strategy_report()`. Returns a DataFrame indexed by ticker with columns including `signal`, `score`, `entry`, `stop`, `shares`, `realized_risk`, etc.

### `export_report_csv(report, path="out/daily_report.csv")`
Saves the report DataFrame to CSV. Creates parent directories automatically.

### `today_actions(report, max_rows=5)`
Returns a plain-text summary of tradable signals (signal in `["both", "breakout", "pullback"]` with `shares >= 1`). Useful for quick daily review without opening the CSV.

### `sector_concentration_warnings(tickers, sector_map, min_candidates=5, threshold=0.4)`
Returns warning strings if a single sector exceeds `threshold` of the candidate list. Requires an externally-supplied `sector_map` (e.g., from `data.ticker_info`).

## Notes

- `build_daily_report()` is a thin wrapper — all logic lives in the `strategy/` module.
- The `today_actions()` output mentions "500€" when no tradable shares can be sized; this reflects the `RiskConfig.account_size` default — override it in `ReportConfig`.
- Output directory (`out/`) is created automatically if missing.

## See Also

- `strategy/orchestrator.py` — actual report construction logic
- `strategy/report_config.py` — `ReportConfig` (account size, risk params, plugin settings)
- `execution/guidance.py` — adds entry/stop guidance columns to the report
- `risk/position_sizing.py` — computes `entry`, `stop`, `shares`, `realized_risk`
