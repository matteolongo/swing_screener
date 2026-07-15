from __future__ import annotations

import pytest

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
