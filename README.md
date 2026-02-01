# Swing Screener

Swing Screener is a conservative, rule-based framework for **daily swing trading** on US equities.
It helps you:

- screen a stock universe after market close
- rank candidates with transparent indicators (trend, momentum, ATR)
- size positions with strict R-based risk rules
- manage open positions with stop/exit suggestions

Execution is intentionally **manual** (Degiro-friendly).

## Key Principles

- Deterministic logic over discretionary decisions
- Risk-first sizing and trade management
- One daily workflow (post-close), no intraday automation
- Files as source of truth (`positions.json`, `orders.json`)

## Project Layout

```text
src/swing_screener/
  cli.py                # CLI entrypoint: run/manage/migrate/universes
  data/                 # Universe loading + market data
  indicators/           # Trend, momentum, volatility (ATR)
  screeners/            # Feature table, filters, ranking
  signals/              # Breakout / pullback entry signals
  risk/                 # Position sizing and trade plans
  reporting/            # Daily report pipeline + exports
  execution/            # Order guidance and order-state models
  portfolio/            # Position state + management + migration helpers
  backtest/             # Deterministic historical simulation in R units
```

## Install

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

CLI command after install:

```bash
swing-screener --help
```

## Quick Start

Run the daily screener:

```bash
swing-screener run --universe mega --positions positions.json --csv out/report.csv
```

Manage open positions:

```bash
swing-screener manage --positions positions.json --md out/degiro_actions.md
```

Apply suggested stop updates to local state:

```bash
swing-screener manage --positions positions.json --apply --md out/degiro_actions.md
```

Backfill links between `orders.json` and `positions.json`:

```bash
swing-screener migrate --orders orders.json --positions positions.json --create-stop-orders
```

Inspect packaged universes:

```bash
swing-screener universes list
```

## Core Data Contracts

- **OHLCV**: pandas DataFrame with MultiIndex columns `(field, ticker)`
- **positions.json**: single source of truth for open positions
- **orders.json**: order lifecycle and position-linked entry/exit orders

## Development

Run tests:

```bash
pytest -q
```

## Documentation

- `docs/OPERATIONAL_GUIDE.md` — day-to-day operational workflow
- `docs/DAILY_USAGE_GUIDE.md` — practical routine and timing
- `docs/UI.md` — UI usage notes

