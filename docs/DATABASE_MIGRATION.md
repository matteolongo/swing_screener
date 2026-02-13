# Database Migration Guide

## Overview

The Swing Screener application has been migrated from file-based state management (JSON files) to a robust SQLite database using SQLAlchemy. This provides:

- **Atomicity**: Changes are made in transactions that either fully succeed or fully rollback
- **Integrity**: Foreign key constraints ensure data consistency
- **Concurrency**: No more file locking issues
- **Performance**: Faster queries and better scalability

## Architecture

### Database Schema

The database consists of two main tables:

#### `positions` table
- `id` (INTEGER, PRIMARY KEY): Auto-increment ID
- `position_id` (STRING, UNIQUE): Business key (e.g., "POS-AAPL-20260201-01")
- `ticker` (STRING): Stock ticker
- `status` (STRING): "open" or "closed"
- `entry_date`, `entry_price`, `stop_price`, `shares`: Position details
- `source_order_id`: Link to the entry order
- `initial_risk`, `max_favorable_price`: Risk tracking
- `exit_date`, `exit_price`: Exit information (for closed positions)
- `notes`: Free-form notes
- `exit_order_ids`: JSON array of linked exit order IDs

#### `orders` table
- `id` (INTEGER, PRIMARY KEY): Auto-increment ID
- `order_id` (STRING, UNIQUE): Business key (e.g., "ORD-INTC-ENTRY")
- `ticker` (STRING): Stock ticker
- `status` (STRING): "pending", "filled", or "cancelled"
- `order_type` (STRING): Order type (e.g., "BUY_LIMIT", "SELL_STOP")
- `quantity`, `limit_price`, `stop_price`: Order parameters
- `order_date`, `filled_date`, `entry_price`: Execution tracking
- `order_kind` (STRING): "entry", "stop", or "take_profit"
- `parent_order_id`: Link to parent order
- `position_id_fk` (STRING, FOREIGN KEY → positions.position_id): Link to position
- `tif` (STRING): Time in force
- `notes`: Free-form notes

#### Foreign Key Relationship
- `orders.position_id_fk` → `positions.position_id`
- Ensures referential integrity between orders and positions

### Database Location

Default database path: `data/swing_screener.db`

## Migration from JSON to SQLite

### One-Time Migration

If you have existing data in `positions.json` and `orders.json`, run the migration script:

```bash
python scripts/migrate_json_to_sqlite.py
```

Options:
- `--orders-path PATH`: Custom path to orders.json (default: data/orders.json)
- `--positions-path PATH`: Custom path to positions.json (default: data/positions.json)
- `--db-path PATH`: Custom path for SQLite database (default: data/swing_screener.db)
- `--force`: Overwrite existing database (use with caution!)

Example:
```bash
# Migrate with defaults
python scripts/migrate_json_to_sqlite.py

# Migrate with custom paths
python scripts/migrate_json_to_sqlite.py \
  --orders-path /path/to/orders.json \
  --positions-path /path/to/positions.json \
  --db-path /path/to/database.db

# Force overwrite existing database
python scripts/migrate_json_to_sqlite.py --force
```

## Code Changes

### Loading Data

**Old approach (file-based):**
```python
from swing_screener.portfolio.state import load_positions
from swing_screener.execution.orders import load_orders

positions = load_positions("data/positions.json")
orders = load_orders("data/orders.json")
```

**New approach (database-based):**
```python
from swing_screener.portfolio.state import load_positions
from swing_screener.execution.orders import load_orders
from swing_screener.db import get_default_db

# Use default database
positions = load_positions()  # Loads from data/swing_screener.db
orders = load_orders()

# Or use custom database
db = get_default_db()  # or Database("custom/path.db")
positions = load_positions(db=db)
orders = load_orders(db=db)
```

### Saving Data

**Old approach (file-based):**
```python
from swing_screener.portfolio.state import save_positions
from swing_screener.execution.orders import save_orders

save_positions("data/positions.json", positions)
save_orders("data/orders.json", orders)
```

**New approach (database transactions):**

The `save_positions()` and `save_orders()` functions are now **deprecated**. Instead, use the workflow functions that perform atomic transactions:

```python
from swing_screener.execution.order_workflows import fill_entry_order

# This function now uses database transactions internally
new_orders, new_positions = fill_entry_order(
    orders=orders,
    positions=positions,
    order_id="ORD-INTC-ENTRY",
    fill_price=50.0,
    fill_date="2026-02-01",
    quantity=10,
    stop_price=45.0,
)
# Changes are automatically committed to the database
```

### Transaction Safety

All state-mutating operations now use database transactions:

```python
from swing_screener.execution.order_workflows import fill_entry_order

try:
    # This entire operation is atomic
    new_orders, new_positions = fill_entry_order(...)
    # If successful, changes are committed
except Exception as e:
    # If any error occurs, all changes are rolled back
    print(f"Order fill failed: {e}")
```

## Testing

### Running Database Tests

```bash
# Run all database tests
pytest tests/test_database.py -v

# Run specific test
pytest tests/test_database.py::test_fill_entry_order_transaction -v
```

### Using In-Memory Database for Tests

```python
from swing_screener.db import Database

def test_my_feature():
    # Use in-memory database for fast, isolated tests
    db = Database(":memory:")
    
    # ... your test code ...
    
    db.close()
```

## Backward Compatibility

The legacy functions `save_positions()` and `save_orders()` are **deprecated** but still present for backward compatibility. They issue deprecation warnings and are no-ops (do nothing).

This allows existing code to continue working during the transition period. However, new code should use the database-based transaction approach.

## Migration Status

### ✅ Completed
- [x] SQLAlchemy schema created (`src/swing_screener/db.py`)
- [x] Database connection and session management
- [x] Position and Order table definitions with foreign keys
- [x] Conversion functions between dataclasses and models
- [x] `load_positions()` rewritten to use database
- [x] `load_orders()` rewritten to use database
- [x] `fill_entry_order()` rewritten with database transactions
- [x] `scale_in_fill()` rewritten with database transactions
- [x] Migration script (`scripts/migrate_json_to_sqlite.py`)
- [x] Database tests (`tests/test_database.py`)

### ⏸️ In Progress (Future Work)
- [ ] Update API repositories to use database directly
- [ ] Update API tests to seed database instead of JSON files
- [ ] Update CLI to use database transactions
- [ ] Remove legacy JSON-based code paths
- [ ] Remove `utils/file_lock.py` (no longer needed with database)
- [ ] Remove `portfolio/migrate.py` (replaced by migration script)

## Troubleshooting

### "No such table" Error

If you see errors about missing tables, the database needs to be initialized:

```python
from swing_screener.db import Database

db = Database("data/swing_screener.db")
# Tables are automatically created on first initialization
```

### Migration Script Fails

If migration fails, check:
1. JSON files exist and are valid JSON
2. Database path is writable
3. No database locks (close any open connections)

### Foreign Key Violations

If you see foreign key errors:
1. Ensure positions are inserted before orders that reference them
2. Check that `position_id` values match between tables

## Database Backup

The SQLite database is a single file, making backups simple:

```bash
# Backup
cp data/swing_screener.db data/swing_screener.db.backup

# Restore
cp data/swing_screener.db.backup data/swing_screener.db
```

For production use, consider automated backups and replication strategies.

## Performance Notes

SQLite is designed for:
- Single-user applications (perfect for swing trading)
- Hundreds of thousands of rows (far more than needed)
- Concurrent reads (unlimited)
- Sequential writes (one at a time)

This is ideal for the Swing Screener use case where:
- One trader uses the system
- Trades are infrequent (daily to weekly)
- Data volume is small (dozens to hundreds of trades)

## Future Enhancements

Possible future improvements:
- Add indices for common queries
- Implement database migrations (e.g., Alembic)
- Add audit trail tables
- Support for multiple strategies/portfolios
- Historical snapshots for backtesting analysis
