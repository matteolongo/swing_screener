# Data Directory

Runtime data for Swing Screener.

## Primary Files
- `orders.json`: order records (primary storage today)
- `positions.json`: position records (primary storage today)
- `watchlist.json`: watchlist state
- `intelligence/`: runtime intelligence snapshots, jobs, caches, and reports
  - `intelligence/evidence/{date}/{ticker}.json`: per-ticker curated catalyst evidence cache (regenerable; gitignored). Created on-demand by the evidence collector pipeline. No schema migration required.
  - `intelligence/history/{TICKER}.json`: durable per-symbol analysis history — a newest-first JSON list of `{generated_at, action, conviction, summary_line, watch_for, pre_open_outlook, predictions}`, capped at `analysis_history.max_entries` (config/intelligence.yaml, default 50). Written after every successful analysis; read for the thesis-drift digest and the UI timeline (`GET /api/intelligence/{ticker}/history`). Regenerable, gitignored. **Migration:** no backfill — history starts empty and accumulates from the first analysis run after deploy. **Schema change (2026-06-25):** `predictions` is a new additive field (list of `{direction, reason, reference}`); old entries without it are read with `predictions: []`. `action` and `conviction` are now enum-validated on read (`DecisionAction` / `DecisionConviction` from `recommendation.models`); a row with an out-of-vocabulary value is skipped (logged as warning), not fatal.
  - `intelligence/intelligence_metrics.json`: append-only per-analysis metrics log (capped at 500 entries, regenerable, gitignored). Each entry: `{ts, ticker, tokens}`. Written by `intelligence/metrics.py` after every analysis. A `tokens: null` entry means a call did not complete; use it to spot SEC blackouts or LLM failures.
- `backtest/jobs/`: background event-study run jobs (one JSON per job; not committed, gitignored). Created on API start; interrupted `queued`/`running` jobs are recovered as `error` on restart.

**Removed files (branch feat/catalyst-evidence-improvements):** `intelligence/catalyst_reports/` (top-down catalyst pipeline output), `intelligence/ir_feeds.json` (hand-seeded IR RSS map), and `intelligence/discovered_feeds_cache.json` (auto-discovered IR feed cache) were all deleted. The IR RSS collector and its auto-discovery layer were removed; SEC EDGAR is now the sole deterministic evidence source.

User-authored configuration no longer lives under `data/`. Shared configuration is stored in:
- `config/user.yaml`
- `config/strategies.yaml`
- `config/intelligence.yaml`
- `config/mcp.yaml`

## Daily Reviews
- `daily_reviews/`: daily review snapshots (not committed)

## positions.json schema notes

New fields added in F13 (Trail Customization):
- `trail_method`: `"sma20" | "atr" | "fixed_pct" | "manual"` — defaults to `"sma20"` when absent (backward-compatible)
- `trail_param`: `float | null` — ATR multiplier for `atr`, percentage for `fixed_pct`; null for `sma20`/`manual`

Existing positions without these fields behave identically to before (SMA20 trail is the default).

New fields added in exhaustion-score feature:
- `last_exhaustion_score`: `float | null` — composite exhaustion score (0–10) from last `evaluate_positions()` run. Higher = more likely topping out.
- `last_exhaustion_label`: `"fine" | "watch" | "exit" | null` — threshold label for `last_exhaustion_score`.

Both fields are optional. Existing positions without them load with `None` (backward-compatible).

New field added in target-persistence feature (2026-06-19):
- `target_price`: `float | null` — planned price target captured on the order at creation
  (prefilled from the screener recommendation, editable on the order ticket) and carried to the
  position on fill. Used to show Target / To-Target / R:R on an open position.

Applies to both `orders.json` (on the order record) and `positions.json` (on the position record).
Optional and backward-compatible: existing orders/positions without it load with `None`, and the
open-position view falls back to the candidate recommendation or shows `—` when no target is stored.

## Instrument master & index universes

`intelligence/instrument_master.json` is the symbol → metadata table
(`exchange_mic`, `country_code`, `currency`, `timezone`, `provider_symbol_map`,
`instrument_type`, …) that universe snapshots are validated against.

Migration (2026-06-12): added 8 stock-index universes sourced from Wikipedia +
yfinance — `us_sp500`, `us_nasdaq100`, `us_dow30`, `germany_dax`, `france_cac40`,
`uk_ftse100`, `spain_ibex35`, `europe_eurostoxx50`. Populating them grew the
instrument master from 421 to 987 records. New records carry
`"source": "wikipedia_yfinance"`; existing records were untouched (the merge is
append-only and never overwrites). Snapshots live under
`src/swing_screener/data/universes/registry/snapshots/`.

Migration (2026-06-17): added 3 Asian index universes — `hongkong_hsi` (benchmark
`^HSI`, HKD, ~85 members), `korea_kospi200` (benchmark `^KS11`, KRW, ~200),
`china_csi300` (benchmark `000300.SS`, CNY, ~298). Populating them extended the
instrument master with HKD/KRW/CNY instruments via `universes refresh --apply`.

New exchange→MIC mappings added in `symbol_discovery.py` and
`instrument_enrichment.py`: `HKG→XHKG`, `KSC→XKRX`, `SHH→XSHG`, `SHZ→XSHE`.

New custom symbol resolvers added in `wikipedia_sources.py`
(`_CUSTOM_SYMBOL_RESOLVERS`):
- HK: zero-pad raw code to 4 digits, append `.HK`
- Korea: zero-pad raw code to 6 digits, append `.KS`
- China: route by the `SSE:`/`SZSE:` prefix in the ticker cell: SSE codes get
  `.SS`, SZSE codes get `.SZ`

Japan / Nikkei 225 deferred: Wikipedia does not publish a machine-readable
constituent table for that index.

Refresh an index (re-fetch constituents + enrich any new symbols):

```bash
python -m swing_screener.cli universes refresh --name <id> --apply
```

Omit `--apply` for a dry-run preview. See
`docs/engineering/MODULE_ARCHITECTURE.md` for the adapter modules.

## Optional Database
- `swing_screener.db`: SQLite database (module exists but not wired by default)
- Migration notes: `docs/engineering/DATABASE_MIGRATION.md`
