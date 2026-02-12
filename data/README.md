# Data Directory

This directory contains runtime data for the Swing Screener application.

## Structure

### Configuration Files
- `active_strategy.json` - Currently active strategy name
- `strategies.json` - Saved strategy configurations

### Execution State (User-Maintained)
- `orders.json` - Pending and filled orders
- `positions.json` - Open positions

### Historical Data (Auto-Generated)
- `daily_reviews/` - Daily review snapshots
  - Format: `daily_review_YYYY-MM-DD_strategyname.json`
  - Example: `daily_review_2026-02-11_default.json`
  - Contains: candidates, position actions, summary
  - Automatically saved on each daily review generation
  - **Not committed to git** (in .gitignore)

### Cache
- `social_cache/` - Cached social sentiment data (not committed)

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

## Notes

- All JSON files use snake_case for keys (Python convention)
- Dates are in ISO 8601 format (YYYY-MM-DD)
- Files are created with `indent=2` for readability
