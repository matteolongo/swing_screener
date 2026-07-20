"""Relational portfolio persistence models."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Integer,
    JSON,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from api.db.base import Base


PRICE = Numeric(20, 8)
MONEY = Numeric(20, 4)


class OrderRow(Base):
    __tablename__ = "portfolio_orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','submitted','filled','cancelled')",
            name="status_valid",
        ),
        CheckConstraint("quantity > 0", name="quantity_positive"),
    )

    order_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    ticker: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)
    order_type: Mapped[str] = mapped_column(String(32))
    order_kind: Mapped[str] = mapped_column(String(24), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    limit_price: Mapped[Decimal | None] = mapped_column(PRICE)
    stop_price: Mapped[Decimal | None] = mapped_column(PRICE)
    target_price: Mapped[Decimal | None] = mapped_column(PRICE)
    entry_price: Mapped[Decimal | None] = mapped_column(PRICE)
    order_date: Mapped[str] = mapped_column(String(10))
    filled_date: Mapped[str | None] = mapped_column(String(10))
    position_id: Mapped[str | None] = mapped_column(String(64), index=True)
    quote_currency: Mapped[str | None] = mapped_column(String(8))
    account_currency: Mapped[str | None] = mapped_column(String(8))
    approval_fx_rate: Mapped[Decimal | None] = mapped_column(PRICE)
    fill_fx_rate: Mapped[Decimal | None] = mapped_column(PRICE)
    fee_eur: Mapped[Decimal | None] = mapped_column(MONEY)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PositionRow(Base):
    __tablename__ = "portfolio_positions"
    __table_args__ = (
        CheckConstraint("status IN ('open','closed')", name="status_valid"),
        CheckConstraint("shares > 0", name="shares_positive"),
        UniqueConstraint("source_order_id", name="uq_position_source_order"),
    )

    position_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_order_id: Mapped[str | None] = mapped_column(String(64), index=True)
    ticker: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)
    shares: Mapped[int] = mapped_column(Integer)
    entry_date: Mapped[str] = mapped_column(String(10))
    exit_date: Mapped[str | None] = mapped_column(String(10))
    entry_price: Mapped[Decimal] = mapped_column(PRICE)
    stop_price: Mapped[Decimal] = mapped_column(PRICE)
    target_price: Mapped[Decimal | None] = mapped_column(PRICE)
    current_price: Mapped[Decimal | None] = mapped_column(PRICE)
    exit_price: Mapped[Decimal | None] = mapped_column(PRICE)
    quote_currency: Mapped[str | None] = mapped_column(String(8))
    account_currency: Mapped[str | None] = mapped_column(String(8))
    entry_fx_rate: Mapped[Decimal | None] = mapped_column(PRICE)
    exit_fx_rate: Mapped[Decimal | None] = mapped_column(PRICE)
    entry_fee_eur: Mapped[Decimal | None] = mapped_column(MONEY)
    exit_fee_eur: Mapped[Decimal | None] = mapped_column(MONEY)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class IdempotencyRecordRow(Base):
    __tablename__ = "idempotency_records"
    __table_args__ = (UniqueConstraint("key", name="uq_idempotency_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    operation: Mapped[str] = mapped_column(String(64))
    key: Mapped[str] = mapped_column(String(200))
    request_hash: Mapped[str] = mapped_column(String(64))
    subject: Mapped[str] = mapped_column(String(255))
    resource: Mapped[str] = mapped_column(String(255), default="")
    status_code: Mapped[int] = mapped_column(Integer)
    response: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class LegacyImportRow(Base):
    __tablename__ = "legacy_imports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    schema_revision: Mapped[str] = mapped_column(String(64))
    orders_sha256: Mapped[str] = mapped_column(String(64))
    positions_sha256: Mapped[str] = mapped_column(String(64))
    order_count: Mapped[int] = mapped_column(Integer)
    position_count: Mapped[int] = mapped_column(Integer)
    orders_asof: Mapped[str | None] = mapped_column(String(32))
    positions_asof: Mapped[str | None] = mapped_column(String(32))
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
