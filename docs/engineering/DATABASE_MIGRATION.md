# Database Migration Guide

> **Status: Planned/partial.** Database module exists but services are not wired by default.  
> **Last Reviewed:** February 17, 2026.

## Current State
- Primary persistence: JSON files in `data/`.
- Database module: `src/swing_screener/db.py` (SQLite + SQLAlchemy).
- Migration helper: `scripts/migrate_json_to_sqlite.py`.

## When Wiring the DB
1. Wire services to DB layer (positions, orders, configs).
2. Add migration step for existing JSON data.
3. Validate parity with existing API behavior.
4. Update tests and docs.
