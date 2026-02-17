# Data Directory

This directory contains runtime data for the Swing Screener application.

## Structure

### Configuration Files
- `active_strategy.json` - Currently active strategy name
- `strategies.json` - Saved strategy configurations

### Execution State

**⚠️ Database-Based (Recommended)**
- `swing_screener.db` - SQLite database containing orders and positions
  - **Not committed to git** (in .gitignore)
  - Created automatically on first use
  - Provides atomic transactions and data integrity
  - See `docs/engineering/DATABASE_MIGRATION.md` for details

**Legacy JSON Files (Deprecated)**
- `orders.json` - Pending and filled orders (file-based, deprecated)
- `positions.json` - Open positions (file-based, deprecated)
  - **Note:** New code should use the database instead
  - These files are still present for backward compatibility
  - Use `scripts/migrate_json_to_sqlite.py` to migrate to database

### Historical Data (Auto-Generated)
- `daily_reviews/` - Daily review snapshots
  - Format: `daily_review_YYYY-MM-DD_strategyname.json`
  - Example: `daily_review_2026-02-11_default.json`
  - Contains: candidates, position actions, summary
  - Automatically saved on each daily review generation
  - **Not committed to git** (in .gitignore)

### Cache
- `social_cache/` - Cached social sentiment data (not committed)

## Database vs JSON Files

### Database (Recommended) ✅
- **File:** `swing_screener.db`
- **Format:** SQLite with SQLAlchemy ORM
- **Advantages:**
  - Atomic transactions (all-or-nothing updates)
  - Foreign key constraints ensure data integrity
  - No file locking issues
  - Better performance for queries
  - Supports concurrent reads
- **Usage:** Automatically used by new code
- **Migration:** Run `python scripts/migrate_json_to_sqlite.py`

### JSON Files (Legacy) ⚠️
- **Files:** `orders.json`, `positions.json`
- **Status:** Deprecated but still supported
- **Limitations:**
  - No transactions (partial updates possible on crash)
  - File locking can cause issues
  - Manual merging required for conflicts
- **Migration Path:** Use migration script to convert to database

## Daily Reviews Archive

Each daily review is automatically saved to preserve historical trading decisions.

**Filename format:** `daily_review_{date}_{strategy}.json`

**Contents:**
```json
{
  "new_candidates": [...],      // Top screener picks
  "positions_hold": [...],       // Positions requiring no action
  "positions_update_stop": [...],// Positions with stop updates
  "positions_close": [...],      // Positions to close
  "summary": {
    "review_date": "2026-02-11",
    "total_positions": 5,
    "no_action": 2,
    "update_stop": 2,
    "close_positions": 1,
    "new_candidates": 10
  }
}
```

**Use cases:**
- Review past trading decisions
- Analyze strategy performance over time
- Track which candidates were recommended when
- Audit position management actions
- Compare actual trades vs. recommendations

**Retention:**
- Files are kept indefinitely
- Can be manually deleted if needed
- Consider archiving old files (e.g., older than 6 months)

## Database Backup

Since the database is a single file, backups are simple:

```bash
# Backup
cp data/swing_screener.db data/swing_screener.db.backup

# Restore
cp data/swing_screener.db.backup data/swing_screener.db
```

## Notes

- All JSON files use snake_case for keys (Python convention)
- Dates are in ISO 8601 format (YYYY-MM-DD)
- Files are created with `indent=2` for readability
- Database schema documented in `docs/engineering/DATABASE_MIGRATION.md`
