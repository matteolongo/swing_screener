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

## Social Cache
- `social_cache/`: cached sentiment data (not committed)

## Optional Database
- `swing_screener.db`: SQLite database (module exists but not wired by default)
- Migration notes: `docs/engineering/DATABASE_MIGRATION.md`
