from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from api.models.portfolio import CreateOrderRequest
from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.services.portfolio_service import PortfolioService
from swing_screener.data.providers import MarketDataProvider


@pytest.fixture
def mock_provider():
    return MagicMock(spec=MarketDataProvider)


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload), encoding="utf-8")


def _build_service(tmp_path, mock_provider):
    orders_file = tmp_path / "orders.json"
    positions_file = tmp_path / "positions.json"
    _write_json(orders_file, {"asof": "2026-03-15", "orders": []})
    _write_json(
        positions_file,
        {
            "asof": "2026-03-15",
            "positions": [
                {
                    "position_id": "POS-REP-1",
                    "ticker": "REP.MC",
                    "status": "open",
                    "entry_date": "2026-03-10",
                    "entry_price": 19.63,
                    "stop_price": 19.63,
                    "shares": 5,
                    "source_order_id": "ORD-REP-ENTRY-1",
                    "initial_risk": 0.0,
                    "max_favorable_price": 23.0,
                    "exit_date": None,
                    "exit_price": None,
                    "current_price": 23.0,
                    "notes": "",
                    "exit_order_ids": ["ORD-REP-STOP-1"],
                }
            ],
        },
    )
    service = PortfolioService(
        orders_repo=OrdersRepository(orders_file),
        positions_repo=PositionsRepository(positions_file),
        provider=mock_provider,
    )
    return service, orders_file


def test_create_add_on_links_existing_position(tmp_path, mock_provider):
    service, orders_file = _build_service(tmp_path, mock_provider)

    order = service.create_order(
        CreateOrderRequest(
            ticker="REP.MC",
            order_type="BUY_LIMIT",
            quantity=5,
            limit_price=22.83,
            stop_price=19.63,
            order_kind="entry",
            entry_mode="ADD_ON",
            position_id="POS-REP-1",
        )
    )

    assert order.position_id == "POS-REP-1"
    stored = json.loads(orders_file.read_text(encoding="utf-8"))
    assert stored["orders"][0]["position_id"] == "POS-REP-1"


def test_create_order_rejects_fresh_entry_when_position_exists(tmp_path, mock_provider):
    service, _ = _build_service(tmp_path, mock_provider)

    with pytest.raises(HTTPException) as exc_info:
        service.create_order(
            CreateOrderRequest(
                ticker="REP.MC",
                order_type="BUY_LIMIT",
                quantity=5,
                limit_price=22.83,
                stop_price=19.63,
                order_kind="entry",
            )
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "REP.MC: open position already exists. Create this as an ADD_ON order instead."


def test_create_order_rejects_second_pending_add_on(tmp_path, mock_provider):
    service, _ = _build_service(tmp_path, mock_provider)
    service.create_order(
        CreateOrderRequest(
            ticker="REP.MC",
            order_type="BUY_LIMIT",
            quantity=5,
            limit_price=22.83,
            stop_price=19.63,
            order_kind="entry",
            entry_mode="ADD_ON",
            position_id="POS-REP-1",
        )
    )

    with pytest.raises(HTTPException) as exc_info:
        service.create_order(
            CreateOrderRequest(
                ticker="REP.MC",
                order_type="BUY_LIMIT",
                quantity=3,
                limit_price=22.5,
                stop_price=19.63,
                order_kind="entry",
                entry_mode="ADD_ON",
                position_id="POS-REP-1",
            )
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "REP.MC: pending entry order already exists."


def test_create_order_rejects_add_on_after_limit_reached(tmp_path, mock_provider):
    service, orders_file = _build_service(tmp_path, mock_provider)
    _write_json(
        orders_file,
        {
            "asof": "2026-03-15",
            "orders": [
                {
                    "order_id": "ORD-REP-ENTRY-1",
                    "ticker": "REP.MC",
                    "status": "filled",
                    "order_type": "BUY_LIMIT",
                    "quantity": 5,
                    "limit_price": 19.63,
                    "stop_price": 19.63,
                    "order_date": "2026-03-10",
                    "filled_date": "2026-03-10",
                    "entry_price": 19.63,
                    "notes": "",
                    "order_kind": "entry",
                    "parent_order_id": None,
                    "position_id": "POS-REP-1",
                    "tif": "GTC",
                },
                {
                    "order_id": "ORD-REP-ADD-1",
                    "ticker": "REP.MC",
                    "status": "filled",
                    "order_type": "BUY_LIMIT",
                    "quantity": 5,
                    "limit_price": 22.83,
                    "stop_price": 19.63,
                    "order_date": "2026-03-14",
                    "filled_date": "2026-03-14",
                    "entry_price": 22.83,
                    "notes": "",
                    "order_kind": "entry",
                    "parent_order_id": None,
                    "position_id": "POS-REP-1",
                    "tif": "GTC",
                },
            ],
        },
    )

    with pytest.raises(HTTPException) as exc_info:
        service.create_order(
            CreateOrderRequest(
                ticker="REP.MC",
                order_type="BUY_LIMIT",
                quantity=2,
                limit_price=23.1,
                stop_price=19.63,
                order_kind="entry",
                entry_mode="ADD_ON",
                position_id="POS-REP-1",
            )
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "REP.MC: add-on limit reached for this position."
