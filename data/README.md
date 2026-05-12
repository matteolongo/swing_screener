# Data Directory

Runtime data for Swing Screener.

## Primary Files
- `orders.json`: order records (primary storage today)
- `positions.json`: position records (primary storage today)
- `watchlist.json`: watchlist state
- `intelligence/`: runtime intelligence snapshots, jobs, caches, and reports

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

## Optional Database
- `swing_screener.db`: SQLite database (module exists but not wired by default)
- Migration notes: `docs/engineering/DATABASE_MIGRATION.md`
