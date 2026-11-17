from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from api.db.models import PortfolioStateRow
from api.db.unit_of_work import PortfolioUnitOfWork
from tests.db.test_repositories import _order, _position


def test_unit_of_work_commits_shared_repository_changes(runtime):
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        uow.begin_write()
        uow.orders.add_order(_order())
        assert uow.orders.get_order("ORD-AAPL-001") is not None
        uow.positions.add_position(_position(source_order_id="ORD-AAPL-001"))
        assert uow.positions.get_position("POS-AAPL-001") is not None

    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        assert len(uow.orders.list_orders()[0]) == 1
        assert len(uow.positions.list_positions()[0]) == 1


def test_unit_of_work_rolls_back_both_repositories(runtime):
    with pytest.raises(RuntimeError, match="injected"):
        with PortfolioUnitOfWork(runtime.session_factory) as uow:
            uow.begin_write()
            uow.orders.add_order(_order())
            uow.positions.add_position(_position())
            raise RuntimeError("injected failure")

    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        assert uow.orders.list_orders()[0] == []
        assert uow.positions.list_positions()[0] == []


def test_sqlite_begin_write_is_immediate(runtime):
    with PortfolioUnitOfWork(runtime.session_factory) as uow:
        uow.begin_write()
        assert uow.session.in_transaction()
        assert uow.write_started is True


def test_portfolio_state_lock_compiles_for_postgres():
    statement = (
        select(PortfolioStateRow)
        .where(PortfolioStateRow.id == 1)
        .with_for_update()
    )

    sql = str(statement.compile(dialect=postgresql.dialect()))

    assert "FOR UPDATE" in sql


def test_audit_events_are_logged_only_after_commit(runtime, caplog):
    with caplog.at_level("INFO", logger="swing_screener.audit"):
        with PortfolioUnitOfWork(runtime.session_factory) as uow:
            uow.begin_write()
            uow.orders.add_order(_order())
            uow.audit("create_order", order_id="ORD-AAPL-001", subject="admin", note=None)
            assert caplog.records == []

    messages = [r.getMessage() for r in caplog.records]
    assert messages == ["portfolio create_order committed order_id=ORD-AAPL-001 subject=admin"]


def test_audit_events_are_logged_as_rolled_back_on_failure(runtime, caplog):
    with caplog.at_level("INFO", logger="swing_screener.audit"):
        with pytest.raises(RuntimeError, match="injected"):
            with PortfolioUnitOfWork(runtime.session_factory) as uow:
                uow.begin_write()
                uow.audit("cancel_order", order_id="ORD-1")
                raise RuntimeError("injected failure")

    assert [(r.levelname, r.getMessage()) for r in caplog.records] == [
        ("WARNING", "portfolio cancel_order rolled_back order_id=ORD-1")
    ]
