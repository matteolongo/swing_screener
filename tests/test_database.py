"""Tests for SQLAlchemy-based database persistence."""
import pytest
from pathlib import Path

from swing_screener.db import (
    Database,
    PositionModel,
    OrderModel,
    position_to_model,
    order_to_model,
    model_to_position,
    model_to_order,
)
from swing_screener.portfolio.state import Position
from swing_screener.execution.orders import Order
from swing_screener.execution.order_workflows import fill_entry_order


def test_database_create_tables():
    """Test that database tables are created correctly."""
    db = Database(":memory:")
    session = db.get_session()
    
    try:
        # Verify tables exist
        assert session.query(PositionModel).count() == 0
        assert session.query(OrderModel).count() == 0
    finally:
        session.close()
        db.close()


def test_position_model_conversion():
    """Test converting between Position dataclass and PositionModel."""
    pos = Position(
        ticker="AAPL",
        status="open",
        entry_date="2026-02-01",
        entry_price=150.0,
        stop_price=145.0,
        shares=10,
        position_id="POS-AAPL-20260201-01",
        source_order_id="ORD-AAPL-ENTRY",
        initial_risk=5.0,
        max_favorable_price=152.0,
        notes="Test position",
        exit_order_ids=["ORD-STOP-123"],
    )
    
    # Convert to model
    model = position_to_model(pos)
    assert model.ticker == "AAPL"
    assert model.status == "open"
    assert model.entry_price == 150.0
    assert model.position_id == "POS-AAPL-20260201-01"
    
    # Convert back to dataclass
    pos2 = model_to_position(model)
    assert pos2.ticker == pos.ticker
    assert pos2.status == pos.status
    assert pos2.entry_price == pos.entry_price
    assert pos2.position_id == pos.position_id
    assert pos2.exit_order_ids == pos.exit_order_ids


def test_order_model_conversion():
    """Test converting between Order dataclass and OrderModel."""
    order = Order(
        order_id="ORD-TEST-123",
        ticker="MSFT",
        status="pending",
        order_type="BUY_LIMIT",
        quantity=5,
        limit_price=420.0,
        stop_price=410.0,
        order_date="2026-02-01",
        filled_date="",
        entry_price=None,
        notes="Test order",
        order_kind="entry",
        parent_order_id=None,
        position_id=None,
        tif="GTC",
    )
    
    # Convert to model
    model = order_to_model(order)
    assert model.order_id == "ORD-TEST-123"
    assert model.ticker == "MSFT"
    assert model.status == "pending"
    assert model.quantity == 5
    
    # Convert back to dataclass
    order2 = model_to_order(model)
    assert order2.order_id == order.order_id
    assert order2.ticker == order.ticker
    assert order2.status == order.status
    assert order2.quantity == order.quantity


def test_fill_entry_order_transaction():
    """Test database persistence after fill_entry_order workflow."""
    db = Database(":memory:")
    
    # Create an initial order
    initial_order = Order(
        order_id="ORD-INTC-ENTRY",
        ticker="INTC",
        status="pending",
        order_type="BUY_LIMIT",
        quantity=0,  # Will be set on fill
        limit_price=50.0,
        stop_price=None,
        order_date="2026-02-01",
        filled_date="",
        entry_price=None,
        notes="Test entry",
        order_kind="entry",
        parent_order_id=None,
        position_id=None,
        tif="GTC",
    )
    
    # Fill the order using in-memory logic
    orders = [initial_order]
    positions = []
    
    new_orders, new_positions = fill_entry_order(
        orders,
        positions,
        "ORD-INTC-ENTRY",
        fill_price=50.0,
        fill_date="2026-02-01",
        quantity=10,
        stop_price=45.0,
    )
    
    # Now persist to database to test conversion
    session = db.get_session()
    try:
        # Insert positions
        for pos in new_positions:
            session.add(position_to_model(pos))
        
        # Insert orders
        for order in new_orders:
            session.add(order_to_model(order))
        
        session.commit()
        
        # Verify data was persisted correctly
        pos_count = session.query(PositionModel).count()
        order_count = session.query(OrderModel).count()
        
        assert pos_count == 1
        assert order_count == 2  # entry (filled) + stop
        
        # Verify position
        pos_model = session.query(PositionModel).filter_by(ticker="INTC").first()
        assert pos_model is not None
        assert pos_model.entry_price == 50.0
        assert pos_model.stop_price == 45.0
        assert pos_model.shares == 10
        
        # Verify orders
        filled_order = session.query(OrderModel).filter_by(order_id="ORD-INTC-ENTRY").first()
        assert filled_order is not None
        assert filled_order.status == "filled"
        assert filled_order.entry_price == 50.0
        
    finally:
        session.close()
        db.close()


def test_database_foreign_key_relationship():
    """Test that foreign key relationships work correctly."""
    db = Database(":memory:")
    session = db.get_session()
    
    try:
        # Create a position
        pos = Position(
            ticker="AAPL",
            status="open",
            entry_date="2026-02-01",
            entry_price=150.0,
            stop_price=145.0,
            shares=10,
            position_id="POS-AAPL-20260201-01",
            source_order_id="ORD-AAPL-ENTRY",
        )
        session.add(position_to_model(pos))
        session.flush()
        
        # Create an order linked to the position
        order = Order(
            order_id="ORD-STOP-AAPL",
            ticker="AAPL",
            status="pending",
            order_type="SELL_STOP",
            quantity=10,
            stop_price=145.0,
            order_date="2026-02-01",
            order_kind="stop",
            position_id="POS-AAPL-20260201-01",
            tif="GTC",
        )
        session.add(order_to_model(order))
        session.commit()
        
        # Query and verify relationship
        pos_model = session.query(PositionModel).filter_by(position_id="POS-AAPL-20260201-01").first()
        assert pos_model is not None
        assert len(pos_model.orders) == 1
        assert pos_model.orders[0].order_id == "ORD-STOP-AAPL"
        
    finally:
        session.close()
        db.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
