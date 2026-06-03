"""Unit tests for DeGiro-related PortfolioService methods."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.services.portfolio_service import PortfolioService


def _make_service(tmp_path: Path) -> PortfolioService:
    pf = tmp_path / "positions.json"
    pf.write_text(json.dumps({"positions": [], "asof": "2026-05-28"}), encoding="utf-8")
    of = tmp_path / "orders.json"
    of.write_text('{"orders": []}', encoding="utf-8")

    provider = MagicMock()
    provider.fetch_ohlcv.return_value = MagicMock(empty=True)
    return PortfolioService(
        positions_repo=PositionsRepository(pf),
        orders_repo=OrdersRepository(of),
        provider=provider,
    )


def test_list_degiro_orders_returns_response(tmp_path: Path) -> None:
    svc = _make_service(tmp_path)
    fake_order = {
        "orderId": "DG-001",
        "productId": "12345",
        "buysell": "B",
        "size": 10,
        "price": 50.0,
        "status": "confirmed",
        "date": "2026-05-20",
    }
    with patch("swing_screener.integrations.degiro.credentials.load_credentials") as lc, \
         patch("swing_screener.integrations.degiro.client.DegiroClient") as ClientCls:
        lc.return_value = MagicMock()
        mock_client = MagicMock()
        mock_client.__enter__ = lambda s: s
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get_orders.return_value = [fake_order]
        ClientCls.return_value = mock_client

        resp = svc.list_degiro_orders()

    assert len(resp.orders) == 1
    assert resp.orders[0].order_id == "DG-001"
    assert resp.orders[0].side == "buy"


def test_fill_order_from_degiro_raises_on_zero_price(tmp_path: Path) -> None:
    """fill_order_from_degiro must raise HTTP 422 when the DeGiro order has no execution price."""
    svc = _make_service(tmp_path)

    # Seed a pending order
    of = tmp_path / "orders.json"
    pending_order = {
        "order_id": "ORD-001",
        "ticker": "AAPL",
        "status": "pending",
        "quantity": 10,
        "isin": None,
    }
    of.write_text(json.dumps({"orders": [pending_order], "asof": "2026-05-28"}), encoding="utf-8")
    svc._orders_repo = svc._orders_repo.__class__(of)

    degiro_history_order = {
        "orderId": "DG-NOPRICE",
        "size": 10,
        # no "price" key — simulates a cancelled/pending DeGiro order
        "date": "2026-05-28",
    }

    from fastapi import HTTPException

    with patch("swing_screener.integrations.degiro.credentials.load_credentials") as lc, \
         patch("swing_screener.integrations.degiro.client.DegiroClient") as ClientCls:
        lc.return_value = MagicMock()
        mock_client = MagicMock()
        mock_client.__enter__ = lambda s: s
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get_order_history.return_value = [degiro_history_order]
        ClientCls.return_value = mock_client

        with pytest.raises(HTTPException) as exc_info:
            svc.fill_order_from_degiro("ORD-001", "DG-NOPRICE")

    assert exc_info.value.status_code == 422
    assert "no execution price" in exc_info.value.detail
