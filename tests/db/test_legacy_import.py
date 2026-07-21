from __future__ import annotations

import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, local

import pytest
from sqlalchemy import delete

from api.db.import_legacy import (
    LegacyImportState,
    LegacyImportStateError,
    classify_import_state,
    import_legacy_portfolio,
    validate_legacy_sources,
)
from api.db.models import LegacyImportRow, PositionRow
from api.db.unit_of_work import PortfolioUnitOfWork


def _factory(runtime):
    return lambda: PortfolioUnitOfWork(runtime.session_factory)


def _write_pair(tmp_path, *, orders=None, positions=None):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    orders_path.write_text(json.dumps({"orders": orders or [], "asof": "2026-07-15"}))
    positions_path.write_text(
        json.dumps({"positions": positions or [], "asof": "2026-07-15"})
    )
    return orders_path, positions_path


def _order():
    return {
        "order_id": "ORD-AAPL-001",
        "ticker": "AAPL",
        "status": "pending",
        "order_type": "BUY_LIMIT",
        "order_kind": "entry",
        "quantity": 2,
        "limit_price": 100,
        "stop_price": 95,
        "target_price": 110,
        "order_date": "2026-07-15",
        "quote_currency": "USD",
        "account_currency": "EUR",
        "approval_fx_rate": 1.1,
    }


def _position():
    return {
        "position_id": "POS-AAPL-001",
        "ticker": "AAPL",
        "status": "open",
        "entry_date": "2026-07-15",
        "entry_price": 100,
        "stop_price": 95,
        "shares": 2,
        "quote_currency": "USD",
        "account_currency": "EUR",
        "entry_fx_rate": 1.1,
    }


def test_imports_empty_database_once_with_checksums_and_preserves_sources(
    runtime, tmp_path
):
    orders_path, positions_path = _write_pair(
        tmp_path, orders=[_order()], positions=[_position()]
    )
    original_orders = orders_path.read_bytes()
    original_positions = positions_path.read_bytes()

    report = import_legacy_portfolio(
        _factory(runtime), orders_path, positions_path, "20260715_0001"
    )

    assert report.state is LegacyImportState.COMPLETE
    assert report.order_count == 1
    assert report.position_count == 1
    assert orders_path.read_bytes() == original_orders
    assert positions_path.read_bytes() == original_positions
    with _factory(runtime)() as uow:
        ledger = uow.session.get(LegacyImportRow, 1)
        assert ledger.orders_sha256 == hashlib.sha256(original_orders).hexdigest()
        assert ledger.positions_sha256 == hashlib.sha256(original_positions).hexdigest()

    repeated = import_legacy_portfolio(
        _factory(runtime), orders_path, positions_path, "20260715_0001"
    )
    assert repeated.imported is False
    assert orders_path.read_bytes() == original_orders


def test_concurrent_import_replays_completed_ledger(runtime, tmp_path):
    """Two startup processes must not race between EMPTY and COMPLETE."""
    orders_path, positions_path = _write_pair(
        tmp_path, orders=[_order()], positions=[_position()]
    )
    barrier = Barrier(2)
    state = local()

    class SynchronizedUnitOfWork:
        def __init__(self):
            self._inner = PortfolioUnitOfWork(runtime.session_factory)

        def __enter__(self):
            entered = self._inner.__enter__()
            if not getattr(state, "first_context_entered", False):
                state.first_context_entered = True
                barrier.wait(timeout=5)
            return entered

        def __exit__(self, *args):
            return self._inner.__exit__(*args)

    def import_once(_index: int):
        return import_legacy_portfolio(
            SynchronizedUnitOfWork,
            orders_path,
            positions_path,
            "20260715_0001",
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        reports = list(executor.map(import_once, range(2)))

    assert {report.imported for report in reports} == {True, False}
    assert all(report.state is LegacyImportState.COMPLETE for report in reports)


def test_invalid_row_rolls_back_everything(runtime, tmp_path):
    invalid = _order()
    invalid["quantity"] = 0
    orders_path, positions_path = _write_pair(
        tmp_path, orders=[invalid], positions=[_position()]
    )

    with pytest.raises(ValueError, match="ORD-AAPL-001"):
        import_legacy_portfolio(
            _factory(runtime), orders_path, positions_path, "20260715_0001"
        )

    with _factory(runtime)() as uow:
        assert classify_import_state(uow.session) is LegacyImportState.EMPTY
        assert uow.orders.list_orders()[0] == []
        assert uow.positions.list_positions()[0] == []


def test_import_normalizes_signed_legacy_broker_fee_without_mutating_source(
    runtime, tmp_path
):
    position = _position()
    position.update(
        {
            "status": "closed",
            "exit_date": "2026-07-16",
            "exit_price": 110,
            "exit_fee_eur": -4.90,
        }
    )
    orders_path, positions_path = _write_pair(
        tmp_path, orders=[_order()], positions=[position]
    )
    original_positions = positions_path.read_bytes()

    report = import_legacy_portfolio(
        _factory(runtime), orders_path, positions_path, "20260715_0001"
    )

    assert report.state is LegacyImportState.COMPLETE
    assert positions_path.read_bytes() == original_positions
    with _factory(runtime)() as uow:
        imported = uow.positions.get_position("POS-AAPL-001")
    assert imported["exit_fee_eur"] == 4.90


def test_partial_database_state_fails_closed(runtime, tmp_path):
    orders_path, positions_path = _write_pair(tmp_path)
    with _factory(runtime)() as uow:
        uow.begin_write()
        uow.orders.add_order(_order())

    with pytest.raises(LegacyImportStateError, match="partial"):
        import_legacy_portfolio(
            _factory(runtime), orders_path, positions_path, "20260715_0001"
        )


def test_blank_legacy_files_create_zero_count_ledger(runtime, tmp_path):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    orders_path.write_bytes(b"")
    positions_path.write_bytes(b"")

    report = import_legacy_portfolio(
        _factory(runtime), orders_path, positions_path, "20260715_0001"
    )

    assert report.imported is True
    assert report.order_count == 0
    assert report.position_count == 0
    with _factory(runtime)() as uow:
        assert classify_import_state(uow.session) is LegacyImportState.COMPLETE


def test_source_validation_reports_counts_and_checksums_without_mutation(tmp_path):
    orders_path, positions_path = _write_pair(
        tmp_path, orders=[_order()], positions=[_position()]
    )
    original_orders = orders_path.read_bytes()
    original_positions = positions_path.read_bytes()

    report = validate_legacy_sources(orders_path, positions_path)

    assert report.order_count == 1
    assert report.position_count == 1
    assert report.orders_sha256 == hashlib.sha256(original_orders).hexdigest()
    assert report.positions_sha256 == hashlib.sha256(original_positions).hexdigest()
    assert orders_path.read_bytes() == original_orders
    assert positions_path.read_bytes() == original_positions


def test_missing_imported_rows_or_wrong_revision_is_partial(runtime, tmp_path):
    orders_path, positions_path = _write_pair(
        tmp_path, orders=[_order()], positions=[_position()]
    )
    import_legacy_portfolio(
        _factory(runtime), orders_path, positions_path, "20260715_0001"
    )

    with _factory(runtime)() as uow:
        uow.begin_write()
        uow.session.execute(delete(PositionRow))

    with _factory(runtime)() as uow:
        assert classify_import_state(uow.session) is LegacyImportState.PARTIAL

    with _factory(runtime)() as uow:
        uow.begin_write()
        uow.positions.add_position(_position())
        ledger = uow.session.get(LegacyImportRow, 1)
        ledger.schema_revision = "unexpected"

    with _factory(runtime)() as uow:
        assert classify_import_state(uow.session) is LegacyImportState.PARTIAL
