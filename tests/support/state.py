"""Temporary JSON portfolio state setup for API tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tests.support.factories.portfolio import orders_document, positions_document


class JsonPortfolioState:
    """Own and install isolated positions/orders JSON files for one test."""

    positions_path: Path
    orders_path: Path

    def __init__(self, positions_path: Path, orders_path: Path) -> None:
        self.positions_path = positions_path
        self.orders_path = orders_path

    def write(
        self,
        *,
        positions: list[dict[str, object]] | None = None,
        orders: list[dict[str, object]] | None = None,
        asof: str = "2026-01-01",
    ) -> None:
        self.positions_path.parent.mkdir(parents=True, exist_ok=True)
        self.orders_path.parent.mkdir(parents=True, exist_ok=True)
        self.positions_path.write_text(
            json.dumps(positions_document(positions, asof=asof)), encoding="utf-8"
        )
        self.orders_path.write_text(
            json.dumps(orders_document(orders, asof=asof)), encoding="utf-8"
        )

    def install(self, monkeypatch: pytest.MonkeyPatch) -> "JsonPortfolioState":
        """Redirect all exposed dependency path aliases to this state."""
        import api.dependencies as dependencies

        monkeypatch.setattr(dependencies, "_positions_path", self.positions_path)
        monkeypatch.setattr(dependencies, "_orders_path", self.orders_path)
        if hasattr(dependencies, "POSITIONS_FILE"):
            monkeypatch.setattr(dependencies, "POSITIONS_FILE", self.positions_path)
        if hasattr(dependencies, "ORDERS_FILE"):
            monkeypatch.setattr(dependencies, "ORDERS_FILE", self.orders_path)
        return self


__all__ = ["JsonPortfolioState"]
