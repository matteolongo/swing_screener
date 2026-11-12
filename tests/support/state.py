"""Isolated SQL portfolio state for API tests."""

from __future__ import annotations

from pathlib import Path

import pytest

from api.db.models import PortfolioStateRow
from api.db.unit_of_work import PortfolioUnitOfWork


def _order(order: dict[str, object]) -> dict[str, object]:
    return {"status": "pending", "order_kind": "entry", **order}


def _position(position: dict[str, object]) -> dict[str, object]:
    return {"status": "open", **position}


class PortfolioDbState:
    """Point the API at a throwaway SQLite portfolio and seed it."""

    def __init__(self, database_path: Path) -> None:
        self.url = f"sqlite:///{database_path}"

    def install(self, monkeypatch: pytest.MonkeyPatch) -> "PortfolioDbState":
        import api.dependencies as dependencies

        monkeypatch.setattr(dependencies, "_test_database_url", self.url)
        return self

    def write(
        self,
        *,
        positions: list[dict[str, object]] | None = None,
        orders: list[dict[str, object]] | None = None,
        asof: str | None = None,
    ) -> None:
        from api.dependencies import get_database_runtime

        runtime = get_database_runtime()
        with PortfolioUnitOfWork(runtime.session_factory) as uow:
            uow.begin_write()
            for position in positions or []:
                uow.positions.add_position(_position(position))
            for order in orders or []:
                uow.orders.add_order(_order(order))
            if asof is not None:
                state = uow.session.get(PortfolioStateRow, 1)
                state.orders_asof = asof
                state.positions_asof = asof


def seed_portfolio(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    *,
    positions: list[dict[str, object]] | None = None,
    orders: list[dict[str, object]] | None = None,
    asof: str | None = None,
) -> PortfolioDbState:
    state = PortfolioDbState(tmp_path / "portfolio.db").install(monkeypatch)
    state.write(positions=positions, orders=orders, asof=asof)
    return state


__all__ = ["PortfolioDbState", "seed_portfolio"]
