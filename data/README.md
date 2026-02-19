# Data Directory

Runtime data for Swing Screener.

## Primary Files
- `active_strategy.json`: active strategy id
- `strategies.json`: saved strategies
- `orders.json`: order records (primary storage today)
- `positions.json`: position records (primary storage today)

## Daily Reviews
- `daily_reviews/`: daily review snapshots (not committed)

## Social Cache
- `social_cache/`: cached sentiment data (not committed)

## Optional Database
- `swing_screener.db`: SQLite database (module exists but not wired by default)
- Migration notes: `docs/engineering/DATABASE_MIGRATION.md`
