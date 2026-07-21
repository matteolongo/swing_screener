"""Atomic, exactly-once import of legacy portfolio JSON state."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Callable

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.db.legacy_models import LegacyOrder, LegacyPosition
from api.db.models import LegacyImportRow, OrderRow, PositionRow
from api.db.unit_of_work import PortfolioUnitOfWork


class LegacyImportState(str, Enum):
    EMPTY = "empty"
    COMPLETE = "complete"
    PARTIAL = "partial"


class LegacyImportStateError(RuntimeError):
    """Raised when existing SQL state cannot be imported safely."""


@dataclass(frozen=True)
class LegacyImportReport:
    state: LegacyImportState
    imported: bool
    order_count: int
    position_count: int
    orders_sha256: str | None = None
    positions_sha256: str | None = None


@dataclass(frozen=True)
class LegacySourceReport:
    order_count: int
    position_count: int
    orders_sha256: str
    positions_sha256: str


UowFactory = Callable[[], PortfolioUnitOfWork]
LEGACY_IMPORT_SCHEMA_REVISION = "20260715_0001"


def classify_import_state(session: Session) -> LegacyImportState:
    orders = session.scalar(select(func.count()).select_from(OrderRow)) or 0
    positions = session.scalar(select(func.count()).select_from(PositionRow)) or 0
    ledger_rows = session.scalars(select(LegacyImportRow)).all()
    if len(ledger_rows) == 1:
        ledger = ledger_rows[0]
        if (
            ledger.schema_revision != LEGACY_IMPORT_SCHEMA_REVISION
            or orders < ledger.order_count
            or positions < ledger.position_count
        ):
            return LegacyImportState.PARTIAL
        return LegacyImportState.COMPLETE
    if orders == 0 and positions == 0 and not ledger_rows:
        return LegacyImportState.EMPTY
    return LegacyImportState.PARTIAL


def _read(path: Path) -> bytes:
    return path.read_bytes() if path.exists() else b""


def _document(raw: bytes, collection: str) -> list[dict]:
    if not raw.strip():
        return []
    value = json.loads(raw)
    if not isinstance(value, dict) or not isinstance(value.get(collection, []), list):
        raise ValueError(f"Legacy {collection} document must contain a list")
    return value.get(collection, [])


def _asof(raw: bytes) -> str | None:
    if not raw.strip():
        return None
    value = json.loads(raw)
    if not isinstance(value, dict):
        return None
    asof = str(value.get("asof") or "").strip()
    return asof or None


def _validate_orders(raw: bytes) -> list[dict]:
    result: list[dict] = []
    for index, item in enumerate(_document(raw, "orders")):
        identifier = item.get("order_id") if isinstance(item, dict) else None
        try:
            result.append(LegacyOrder.model_validate(item).model_dump())
        except ValidationError as exc:
            raise ValueError(
                f"Legacy order {identifier or f'row {index}'} is invalid: {exc}"
            ) from exc
    return result


def _validate_positions(raw: bytes) -> list[dict]:
    result: list[dict] = []
    for index, item in enumerate(_document(raw, "positions")):
        identifier = item.get("position_id") if isinstance(item, dict) else None
        try:
            result.append(LegacyPosition.model_validate(item).model_dump())
        except ValidationError as exc:
            raise ValueError(
                f"Legacy position {identifier or f'row {index}'} is invalid: {exc}"
            ) from exc
    return result


def validate_legacy_sources(
    orders_path: Path, positions_path: Path
) -> LegacySourceReport:
    """Validate both source documents without changing files or SQL state."""
    orders_raw = _read(orders_path)
    positions_raw = _read(positions_path)
    orders_sha = hashlib.sha256(orders_raw).hexdigest()
    positions_sha = hashlib.sha256(positions_raw).hexdigest()
    orders = _validate_orders(orders_raw)
    positions = _validate_positions(positions_raw)
    if (
        hashlib.sha256(_read(orders_path)).hexdigest() != orders_sha
        or hashlib.sha256(_read(positions_path)).hexdigest() != positions_sha
    ):
        raise LegacyImportStateError(
            "Legacy source checksum changed during validation; retry the dry run"
        )
    return LegacySourceReport(
        order_count=len(orders),
        position_count=len(positions),
        orders_sha256=orders_sha,
        positions_sha256=positions_sha,
    )


def _report_from_ledger(ledger: LegacyImportRow) -> LegacyImportReport:
    return LegacyImportReport(
        state=LegacyImportState.COMPLETE,
        imported=False,
        order_count=ledger.order_count,
        position_count=ledger.position_count,
        orders_sha256=ledger.orders_sha256,
        positions_sha256=ledger.positions_sha256,
    )


def import_legacy_portfolio(
    uow_factory: UowFactory,
    orders_path: Path,
    positions_path: Path,
    schema_revision: str,
) -> LegacyImportReport:
    with uow_factory() as uow:
        state = classify_import_state(uow.session)
        if state is LegacyImportState.COMPLETE:
            ledger = uow.session.scalar(select(LegacyImportRow))
            assert ledger is not None
            return _report_from_ledger(ledger)
        if state is LegacyImportState.PARTIAL:
            raise LegacyImportStateError(
                "Legacy import state is partial; restore a database backup or clear all portfolio tables and retry"
            )

    orders_raw = _read(orders_path)
    positions_raw = _read(positions_path)
    orders_sha = hashlib.sha256(orders_raw).hexdigest()
    positions_sha = hashlib.sha256(positions_raw).hexdigest()
    orders = _validate_orders(orders_raw)
    positions = _validate_positions(positions_raw)

    with uow_factory() as uow:
        uow.begin_write()
        uow.lock_legacy_import()
        state = classify_import_state(uow.session)
        if state is LegacyImportState.COMPLETE:
            ledger = uow.session.scalar(select(LegacyImportRow))
            assert ledger is not None
            return _report_from_ledger(ledger)
        if state is not LegacyImportState.EMPTY:
            raise LegacyImportStateError(
                f"Legacy import state changed to {state.value}; no rows were imported"
            )
        for position in positions:
            uow.positions.add_position(position)
        for order in orders:
            uow.orders.add_order(order)
        if (
            hashlib.sha256(_read(orders_path)).hexdigest() != orders_sha
            or hashlib.sha256(_read(positions_path)).hexdigest() != positions_sha
        ):
            raise LegacyImportStateError(
                "Legacy source checksum changed during import; transaction rolled back"
            )
        uow.session.add(
            LegacyImportRow(
                id=1,
                schema_revision=schema_revision,
                orders_sha256=orders_sha,
                positions_sha256=positions_sha,
                order_count=len(orders),
                position_count=len(positions),
                orders_asof=_asof(orders_raw),
                positions_asof=_asof(positions_raw),
            )
        )

    return LegacyImportReport(
        state=LegacyImportState.COMPLETE,
        imported=True,
        order_count=len(orders),
        position_count=len(positions),
        orders_sha256=orders_sha,
        positions_sha256=positions_sha,
    )
