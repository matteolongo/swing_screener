"""Database module for SQLAlchemy-based persistence."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    String,
    create_engine,
    text,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session

Base = declarative_base()


class PositionModel(Base):
    """SQLAlchemy model for Position."""

    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    position_id = Column(String, unique=True, nullable=True, index=True)
    ticker = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, index=True)  # 'open' or 'closed'
    entry_date = Column(String, nullable=False)
    entry_price = Column(Float, nullable=False)
    stop_price = Column(Float, nullable=False)
    shares = Column(Integer, nullable=False)
    source_order_id = Column(String, nullable=True)
    initial_risk = Column(Float, nullable=True)
    max_favorable_price = Column(Float, nullable=True)
    exit_date = Column(String, nullable=True)
    exit_price = Column(Float, nullable=True)
    notes = Column(String, default="")
    exit_order_ids = Column(String, nullable=True)  # JSON array as string

    # Relationship
    orders = relationship("OrderModel", back_populates="position", foreign_keys="OrderModel.position_id_fk")


class OrderModel(Base):
    """SQLAlchemy model for Order."""

    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String, unique=True, nullable=False, index=True)
    ticker = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, index=True)  # 'pending', 'filled', 'cancelled'
    order_type = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    limit_price = Column(Float, nullable=True)
    stop_price = Column(Float, nullable=True)
    order_date = Column(String, default="")
    filled_date = Column(String, default="")
    entry_price = Column(Float, nullable=True)
    notes = Column(String, default="")
    order_kind = Column(String, nullable=True)  # 'entry', 'stop', 'take_profit'
    parent_order_id = Column(String, nullable=True)
    position_id_fk = Column(String, ForeignKey("positions.position_id"), nullable=True, index=True)
    tif = Column(String, nullable=True)
    fee_eur = Column(Float, nullable=True)
    fill_fx_rate = Column(Float, nullable=True)

    # Relationship
    position = relationship("PositionModel", back_populates="orders", foreign_keys=[position_id_fk])


class Database:
    """Database connection and session management."""

    def __init__(self, db_path: str | Path = "data/swing_screener.db"):
        """Initialize database connection.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        # Create engine and session factory
        self.engine = create_engine(f"sqlite:///{self.db_path}", echo=False)
        self.SessionLocal = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)

        # Create tables if they don't exist
        Base.metadata.create_all(self.engine)

    def get_session(self) -> Session:
        """Get a new database session."""
        return self.SessionLocal()

    def close(self):
        """Close database connection."""
        self.engine.dispose()


def get_default_db() -> Database:
    """Get the default database instance."""
    return Database()


def position_to_model(position) -> PositionModel:
    """Convert Position dataclass to PositionModel.
    
    Args:
        position: Position dataclass instance
        
    Returns:
        PositionModel instance
    """
    exit_order_ids_str = None
    if position.exit_order_ids is not None:
        exit_order_ids_str = json.dumps(position.exit_order_ids)
    
    return PositionModel(
        position_id=position.position_id,
        ticker=position.ticker,
        status=position.status,
        entry_date=position.entry_date,
        entry_price=position.entry_price,
        stop_price=position.stop_price,
        shares=position.shares,
        source_order_id=position.source_order_id,
        initial_risk=position.initial_risk,
        max_favorable_price=position.max_favorable_price,
        exit_date=position.exit_date,
        exit_price=position.exit_price,
        notes=position.notes,
        exit_order_ids=exit_order_ids_str,
    )


def model_to_position(model: PositionModel):
    """Convert PositionModel to Position dataclass.
    
    Args:
        model: PositionModel instance
        
    Returns:
        Position dataclass instance
    """
    from swing_screener.portfolio.state import Position
    
    exit_order_ids = None
    if model.exit_order_ids:
        exit_order_ids = json.loads(model.exit_order_ids)
    
    return Position(
        ticker=model.ticker,
        status=model.status,
        entry_date=model.entry_date,
        entry_price=model.entry_price,
        stop_price=model.stop_price,
        shares=model.shares,
        position_id=model.position_id,
        source_order_id=model.source_order_id,
        initial_risk=model.initial_risk,
        max_favorable_price=model.max_favorable_price,
        exit_date=model.exit_date,
        exit_price=model.exit_price,
        notes=model.notes,
        exit_order_ids=exit_order_ids,
    )


def order_to_model(order) -> OrderModel:
    """Convert Order dataclass to OrderModel.
    
    Args:
        order: Order dataclass instance
        
    Returns:
        OrderModel instance
    """
    return OrderModel(
        order_id=order.order_id,
        ticker=order.ticker,
        status=order.status,
        order_type=order.order_type,
        quantity=order.quantity,
        limit_price=order.limit_price,
        stop_price=order.stop_price,
        order_date=order.order_date,
        filled_date=order.filled_date,
        entry_price=order.entry_price,
        notes=order.notes,
        order_kind=order.order_kind,
        parent_order_id=order.parent_order_id,
        position_id_fk=order.position_id,
        tif=order.tif,
        fee_eur=order.fee_eur,
        fill_fx_rate=order.fill_fx_rate,
    )


def model_to_order(model: OrderModel):
    """Convert OrderModel to Order dataclass.
    
    Args:
        model: OrderModel instance
        
    Returns:
        Order dataclass instance
    """
    from swing_screener.execution.orders import Order
    
    return Order(
        order_id=model.order_id,
        ticker=model.ticker,
        status=model.status,
        order_type=model.order_type,
        quantity=model.quantity,
        limit_price=model.limit_price,
        stop_price=model.stop_price,
        order_date=model.order_date,
        filled_date=model.filled_date,
        entry_price=model.entry_price,
        notes=model.notes,
        order_kind=model.order_kind,
        parent_order_id=model.parent_order_id,
        position_id=model.position_id_fk,
        tif=model.tif,
        fee_eur=model.fee_eur,
        fill_fx_rate=model.fill_fx_rate,
    )
