#!/usr/bin/env python
"""
One-time migration script to convert JSON-based state files to SQLite database.

Usage:
    python scripts/migrate_json_to_sqlite.py [--orders-path PATH] [--positions-path PATH] [--db-path PATH]

This script:
1. Reads all data from positions.json and orders.json
2. Creates a new SQLite database with the appropriate schema
3. Inserts all data into the database tables
4. Validates that relationships are maintained
"""

import argparse
import json
import sys
from pathlib import Path

# Add src to path so we can import modules
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from swing_screener.db import Database, PositionModel, OrderModel, position_to_model, order_to_model
from swing_screener.portfolio.state import Position
from swing_screener.execution.orders import Order


def load_json_positions(path: Path) -> list[Position]:
    """Load positions from JSON file using the old format."""
    if not path.exists():
        print(f"Warning: {path} does not exist, skipping positions")
        return []
    
    data = json.loads(path.read_text(encoding="utf-8"))
    positions = []
    
    for item in data.get("positions", []):
        positions.append(
            Position(
                ticker=str(item["ticker"]).upper(),
                status=item.get("status", "open"),
                position_id=item.get("position_id", None),
                source_order_id=item.get("source_order_id", None),
                entry_date=item["entry_date"],
                entry_price=float(item["entry_price"]),
                stop_price=float(item["stop_price"]),
                shares=int(item["shares"]),
                initial_risk=(
                    float(item["initial_risk"])
                    if item.get("initial_risk") is not None
                    else None
                ),
                max_favorable_price=(
                    float(item["max_favorable_price"])
                    if item.get("max_favorable_price") is not None
                    else None
                ),
                exit_date=(
                    str(item.get("exit_date")).strip()
                    if item.get("exit_date")
                    else None
                ),
                exit_price=(
                    float(item["exit_price"])
                    if item.get("exit_price") is not None
                    else None
                ),
                notes=str(item.get("notes", "")),
                exit_order_ids=(
                    [str(x) for x in item.get("exit_order_ids", [])]
                    if isinstance(item.get("exit_order_ids", None), list)
                    else None
                ),
            )
        )
    
    return positions


def load_json_orders(path: Path) -> list[Order]:
    """Load orders from JSON file using the old format."""
    if not path.exists():
        print(f"Warning: {path} does not exist, skipping orders")
        return []
    
    data = json.loads(path.read_text(encoding="utf-8"))
    orders = []
    
    for idx, item in enumerate(data.get("orders", [])):
        ticker = str(item.get("ticker", "")).strip().upper()
        if not ticker:
            continue
        
        order_id = str(item.get("order_id", "")).strip() or f"{ticker}-{idx + 1}"
        status_raw = str(item.get("status", "pending")).strip().lower()
        status = status_raw if status_raw in {"pending", "filled", "cancelled"} else "pending"
        order_kind_raw = str(item.get("order_kind", "")).strip().lower()
        order_kind = (
            order_kind_raw
            if order_kind_raw in {"entry", "stop", "take_profit"}
            else None
        )

        orders.append(
            Order(
                order_id=order_id,
                ticker=ticker,
                status=status,
                order_type=str(item.get("order_type", "")).strip().upper(),
                quantity=int(item.get("quantity", 0) or 0),
                limit_price=(
                    float(item["limit_price"])
                    if item.get("limit_price") is not None
                    else None
                ),
                stop_price=(
                    float(item["stop_price"])
                    if item.get("stop_price") is not None
                    else None
                ),
                order_date=str(item.get("order_date", "")).strip(),
                filled_date=str(item.get("filled_date", "")).strip(),
                entry_price=(
                    float(item["entry_price"])
                    if item.get("entry_price") is not None
                    else None
                ),
                notes=str(item.get("notes", "")).strip(),
                order_kind=order_kind,
                parent_order_id=item.get("parent_order_id", None),
                position_id=item.get("position_id", None),
                tif=item.get("tif", None),
            )
        )
    
    return orders


def migrate(orders_path: Path, positions_path: Path, db_path: Path, force: bool = False):
    """Migrate data from JSON files to SQLite database.
    
    Args:
        orders_path: Path to orders.json
        positions_path: Path to positions.json
        db_path: Path to SQLite database file
        force: If True, delete existing database before migration
    """
    # Check if database already exists
    if db_path.exists() and not force:
        print(f"Error: Database {db_path} already exists. Use --force to overwrite.")
        sys.exit(1)
    
    if force and db_path.exists():
        print(f"Removing existing database: {db_path}")
        db_path.unlink()
    
    # Load data from JSON files
    print(f"Loading positions from {positions_path}...")
    positions = load_json_positions(positions_path)
    print(f"  Loaded {len(positions)} positions")
    
    print(f"Loading orders from {orders_path}...")
    orders = load_json_orders(orders_path)
    print(f"  Loaded {len(orders)} orders")
    
    # Create database
    print(f"Creating database at {db_path}...")
    db = Database(db_path)
    session = db.get_session()
    
    try:
        # Insert positions first (they are referenced by orders)
        print("Inserting positions into database...")
        for pos in positions:
            session.add(position_to_model(pos))
        session.flush()  # Flush to DB but don't commit yet
        print(f"  Inserted {len(positions)} positions")
        
        # Insert orders
        print("Inserting orders into database...")
        for order in orders:
            session.add(order_to_model(order))
        session.flush()
        print(f"  Inserted {len(orders)} orders")
        
        # Commit transaction
        session.commit()
        print("Migration completed successfully!")
        
        # Verify the data
        print("\nVerifying data...")
        pos_count = session.query(PositionModel).count()
        order_count = session.query(OrderModel).count()
        print(f"  Positions in database: {pos_count}")
        print(f"  Orders in database: {order_count}")
        
        if pos_count != len(positions):
            print(f"  WARNING: Position count mismatch! Expected {len(positions)}, got {pos_count}")
        
        if order_count != len(orders):
            print(f"  WARNING: Order count mismatch! Expected {len(orders)}, got {order_count}")
        
    except Exception as e:
        session.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        session.close()
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Migrate JSON state files to SQLite database"
    )
    parser.add_argument(
        "--orders-path",
        type=Path,
        default=Path("data/orders.json"),
        help="Path to orders.json (default: data/orders.json)"
    )
    parser.add_argument(
        "--positions-path",
        type=Path,
        default=Path("data/positions.json"),
        help="Path to positions.json (default: data/positions.json)"
    )
    parser.add_argument(
        "--db-path",
        type=Path,
        default=Path("data/swing_screener.db"),
        help="Path to SQLite database (default: data/swing_screener.db)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force migration even if database exists (will delete existing database)"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("JSON to SQLite Migration Script")
    print("=" * 60)
    print(f"Orders JSON:    {args.orders_path}")
    print(f"Positions JSON: {args.positions_path}")
    print(f"Database:       {args.db_path}")
    print(f"Force:          {args.force}")
    print("=" * 60)
    print()
    
    migrate(args.orders_path, args.positions_path, args.db_path, args.force)


if __name__ == "__main__":
    main()
