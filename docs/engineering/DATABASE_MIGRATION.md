# Database Migration Guide

> **Status: Planned/partial.** Database module exists but is not the default persistence path yet.  
> **Last Reviewed:** February 17, 2026.

## Overview

The Swing Screener application has added SQLite database infrastructure using SQLAlchemy. This provides a foundation for:

- **Atomicity**: Transaction support for atomic state changes
- **Integrity**: Foreign key constraints ensure data consistency
- **Concurrency**: Better handling of concurrent operations
- **Performance**: Faster queries with indexed lookups

> **Note:** The database infrastructure exists, but core workflow functions still use file-based operations by default. Migration can proceed once services are wired to the database.

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

### Current Implementation

The database infrastructure is **ready to use** but core functions still use file-based operations for backward compatibility.

### Loading Data (File-Based)

```python
from swing_screener.portfolio.state import load_positions
from swing_screener.execution.orders import load_orders

# Load from JSON files (current default)
positions = load_positions("data/positions.json")
orders = load_orders("data/orders.json")
```

### Saving Data (File-Based)

```python
from swing_screener.portfolio.state import save_positions
from swing_screener.execution.orders import save_orders

# Save to JSON files (current default)
save_positions("data/positions.json", positions)
save_orders("data/orders.json", orders)
```

### Using Database Directly

If you want to use the database, you can access it directly:

```python
from swing_screener.db import Database, position_to_model, order_to_model

# Create database connection
db = Database("data/swing_screener.db")
session = db.get_session()

try:
    # Insert a position
    session.add(position_to_model(position))
    
    # Insert orders
    for order in orders:
        session.add(order_to_model(order))
    
    # Commit transaction
    session.commit()
finally:
    session.close()
    db.close()
```

### Workflow Functions (In-Memory)

Workflow functions like `fill_entry_order()` currently work with in-memory lists:

```python
from swing_screener.execution.order_workflows import fill_entry_order

# Works with in-memory lists (no database required)
new_orders, new_positions = fill_entry_order(
    orders=orders,
    positions=positions,
    order_id="ORD-INTC-ENTRY",
    fill_price=50.0,
    fill_date="2026-02-01",
    quantity=10,
    stop_price=45.0,
)
# Result is in-memory - persist manually if using database
```

### Future: Transaction-Based Workflows

Future versions may support database transactions in workflow functions:

```python
from swing_screener.execution.order_workflows import fill_entry_order
from swing_screener.db import Database

db = Database("data/swing_screener.db")

# Future: optional db parameter for transactional behavior
new_orders, new_positions = fill_entry_order(
    orders=orders,
    positions=positions,
    order_id="ORD-INTC-ENTRY",
    fill_price=50.0,
    fill_date="2026-02-01",
    quantity=10,
    stop_price=45.0,
    db=db  # Future feature - not yet implemented
)
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
- [x] Migration script (`scripts/migrate_json_to_sqlite.py`)
- [x] Database tests (`tests/test_database.py`)

### ⏸️ Deferred for Backward Compatibility
- [ ] `load_positions()` and `load_orders()` - still file-based
- [ ] `fill_entry_order()` and `scale_in_fill()` - still in-memory
- [ ] Update API repositories to use database directly
- [ ] Update API tests to seed database instead of JSON files
- [ ] Update CLI to use database transactions
- [ ] Remove legacy file-based code paths

## Current Status

**Infrastructure Ready ✅**
- Database schema is complete and tested
- Migration script works with production data
- All conversion functions working

**Integration Deferred ⏸️**
- Core functions remain file-based for backward compatibility
- Tests continue to work without modification
- Migration path is clear for future adoption

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
