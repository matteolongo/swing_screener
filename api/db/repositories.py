"""Session-bound order and position repositories."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Mapping

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.db.models import OrderRow, PositionRow
from api.utils.files import get_today_str


ORDER_FIELDS = {
    "order_id",
    "ticker",
    "status",
    "order_type",
    "order_kind",
    "quantity",
    "limit_price",
    "stop_price",
    "target_price",
    "entry_price",
    "order_date",
    "filled_date",
    "position_id",
    "quote_currency",
    "account_currency",
    "approval_fx_rate",
    "fill_fx_rate",
    "fee_eur",
}
POSITION_FIELDS = {
    "position_id",
    "source_order_id",
    "ticker",
    "status",
    "shares",
    "entry_date",
    "exit_date",
    "entry_price",
    "stop_price",
    "target_price",
    "current_price",
    "exit_price",
    "quote_currency",
    "account_currency",
    "entry_fx_rate",
    "exit_fx_rate",
    "entry_fee_eur",
    "exit_fee_eur",
}
NUMERIC_FIELDS = {
    "limit_price",
    "stop_price",
    "target_price",
    "entry_price",
    "current_price",
    "exit_price",
    "approval_fx_rate",
    "fill_fx_rate",
    "entry_fx_rate",
    "exit_fx_rate",
    "fee_eur",
    "entry_fee_eur",
    "exit_fee_eur",
}


def _json_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    return value


def _float(value: Any) -> Any:
    return float(value) if isinstance(value, Decimal) else value


def _serialize(row: OrderRow | PositionRow, fields: set[str]) -> dict:
    result = dict(row.payload or {})
    for name in fields:
        value = getattr(row, name)
        result[name] = _float(value) if name in NUMERIC_FIELDS else value
    result["version"] = row.version
    return result


def _split(value: Mapping[str, object], fields: set[str]) -> tuple[dict, dict]:
    core = {name: value.get(name) for name in fields}
    payload = {
        name: _json_value(item)
        for name, item in value.items()
        if name not in fields and name not in {"version", "created_at", "updated_at"}
    }
    return core, payload


def _apply(
    row: OrderRow | PositionRow, updates: Mapping[str, object], fields: set[str]
) -> None:
    payload = dict(row.payload or {})
    for name, value in updates.items():
        if name in fields:
            setattr(row, name, value)
        elif name not in {"version", "created_at", "updated_at"}:
            payload[name] = _json_value(value)
    row.payload = payload


class SqlOrdersRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_orders(self, status: str | None = None) -> tuple[list[dict], str]:
        statement = select(OrderRow).order_by(OrderRow.order_id)
        if status:
            statement = statement.where(OrderRow.status == status)
        rows = self.session.scalars(statement).all()
        asof = max((row.order_date for row in rows), default=get_today_str())
        return [_serialize(row, ORDER_FIELDS) for row in rows], asof

    def get_order(self, order_id: str, *, for_update: bool = False) -> dict | None:
        statement = select(OrderRow).where(OrderRow.order_id == order_id)
        if for_update:
            statement = statement.with_for_update()
        row = self.session.scalar(statement)
        return _serialize(row, ORDER_FIELDS) if row else None

    def add_order(self, order: Mapping[str, object]) -> dict:
        core, payload = _split(order, ORDER_FIELDS)
        row = OrderRow(**core, payload=payload)
        self.session.add(row)
        self.session.flush()
        return _serialize(row, ORDER_FIELDS)

    append_order = add_order

    def transition(
        self,
        order_id: str,
        expected: set[str],
        updates: Mapping[str, object],
    ) -> dict | None:
        row = self.session.scalar(
            select(OrderRow).where(OrderRow.order_id == order_id).with_for_update()
        )
        if row is None or row.status not in expected:
            return None
        _apply(row, updates, ORDER_FIELDS)
        row.version += 1
        self.session.flush()
        return _serialize(row, ORDER_FIELDS)


class SqlPositionsRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_positions(self, status: str | None = None) -> tuple[list[dict], str]:
        statement = select(PositionRow).order_by(PositionRow.position_id)
        if status:
            statement = statement.where(PositionRow.status == status)
        rows = self.session.scalars(statement).all()
        asof = max((row.entry_date for row in rows), default=get_today_str())
        return [_serialize(row, POSITION_FIELDS) for row in rows], asof

    def get_position(
        self, position_id: str, *, for_update: bool = False
    ) -> dict | None:
        statement = select(PositionRow).where(PositionRow.position_id == position_id)
        if for_update:
            statement = statement.with_for_update()
        row = self.session.scalar(statement)
        return _serialize(row, POSITION_FIELDS) if row else None

    def add_position(self, position: Mapping[str, object]) -> dict:
        core, payload = _split(position, POSITION_FIELDS)
        row = PositionRow(**core, payload=payload)
        self.session.add(row)
        self.session.flush()
        return _serialize(row, POSITION_FIELDS)

    def replace_position(
        self,
        position_id: str,
        expected_version: int,
        value: Mapping[str, object],
    ) -> dict | None:
        row = self.session.scalar(
            select(PositionRow)
            .where(PositionRow.position_id == position_id)
            .with_for_update()
        )
        if row is None or row.version != expected_version:
            return None
        _apply(row, value, POSITION_FIELDS)
        row.version += 1
        self.session.flush()
        return _serialize(row, POSITION_FIELDS)
