from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path
from unittest.mock import MagicMock

import pandas as pd
import pytest

from api.models.portfolio import CreateOrderRequest, UpdateStopRequest
from api.repositories.orders_repo import OrdersRepository
from api.repositories.positions_repo import PositionsRepository
from api.services.portfolio_service import PortfolioService
from swing_screener.data.providers import MarketDataProvider
from swing_screener.execution.providers import (
    ExecutionOrder,
    ExecutionPosition,
    ExecutionProvider,
    SubmitOrderRequest,
)


class FakeExecutionProvider(ExecutionProvider):
    def __init__(self, orders: list[ExecutionOrder], positions: list[ExecutionPosition]):
        self._orders = list(orders)
        self._positions = list(positions)
        self.cancelled: list[str] = []
        self.submitted: list[SubmitOrderRequest] = []
        self._counter = 0

    def get_provider_name(self) -> str:
        return "fake-broker"

    def list_orders(self, status=None, ticker=None):
        out = list(self._orders)
        if status:
            out = [o for o in out if o.status == status]
        if ticker:
            out = [o for o in out if o.ticker.upper() == ticker.upper()]
        return out

    def get_order(self, order_id: str):
        for order in self._orders:
            if order.order_id == order_id:
                return order
        raise KeyError(order_id)

    def submit_order(self, request: SubmitOrderRequest):
        self.submitted.append(request)
        self._counter += 1
        order = ExecutionOrder(
            order_id=f"BROKER-{self._counter}",
            ticker=request.ticker.upper(),
            status="pending",
            side=request.side,
            order_type=request.order_type,
            quantity=request.quantity,
            filled_quantity=0.0,
            limit_price=request.limit_price,
            stop_price=request.stop_price,
            tif=request.tif,
            submitted_at="2026-02-19T10:00:00",
            filled_at=None,
            avg_fill_price=None,
            client_order_id=request.client_order_id,
            raw_status="new",
        )
        self._orders.insert(0, order)
        return order

    def cancel_order(self, order_id: str) -> None:
        self.cancelled.append(order_id)
        for idx, order in enumerate(self._orders):
            if order.order_id == order_id:
                self._orders[idx] = replace(order, status="cancelled", raw_status="canceled")
                return
        raise KeyError(order_id)

    def list_positions(self):
        return list(self._positions)

    def get_open_position(self, ticker: str):
        for position in self._positions:
            if position.ticker.upper() == ticker.upper():
                return position
        return None


def _repos(tmp_path: Path) -> tuple[OrdersRepository, PositionsRepository]:
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    orders_path = data_dir / "orders.json"
    positions_path = data_dir / "positions.json"
    orders_path.write_text(json.dumps({"asof": "2026-02-18", "orders": []}), encoding="utf-8")
    positions_path.write_text(json.dumps({"asof": "2026-02-18", "positions": []}), encoding="utf-8")
    return OrdersRepository(orders_path), PositionsRepository(positions_path)


def _mock_market_provider() -> MarketDataProvider:
    provider = MagicMock(spec=MarketDataProvider)
    provider.get_provider_name.return_value = "mock"
    provider.fetch_ohlcv.return_value = pd.DataFrame()
    return provider


def test_broker_mode_positions_are_read_from_execution_provider(tmp_path: Path):
    orders_repo, positions_repo = _repos(tmp_path)
    broker = FakeExecutionProvider(
        orders=[
            ExecutionOrder(
                order_id="ENTRY-AAPL",
                ticker="AAPL",
                status="filled",
                side="buy",
                order_type="limit",
                quantity=10,
                filled_quantity=10,
                limit_price=100.0,
                stop_price=None,
                tif="gtc",
                submitted_at="2026-02-10T09:31:00",
                filled_at="2026-02-10T09:31:03",
                avg_fill_price=100.0,
                client_order_id="ENTRY-AAPL",
                raw_status="filled",
            ),
            ExecutionOrder(
                order_id="STOP-AAPL",
                ticker="AAPL",
                status="pending",
                side="sell",
                order_type="stop",
                quantity=10,
                filled_quantity=0,
                limit_price=None,
                stop_price=95.0,
                tif="gtc",
                submitted_at="2026-02-10T09:32:00",
                filled_at=None,
                avg_fill_price=None,
                client_order_id="STOP-AAPL",
                raw_status="new",
            ),
        ],
        positions=[
            ExecutionPosition(
                ticker="AAPL",
                quantity=10,
                avg_entry_price=100.0,
                current_price=110.0,
                market_value=1100.0,
                unrealized_pl=100.0,
            )
        ],
    )
    service = PortfolioService(
        orders_repo=orders_repo,
        positions_repo=positions_repo,
        provider=_mock_market_provider(),
        execution_provider=broker,
    )

    response = service.list_positions(status="open")
    assert len(response.positions) == 1
    position = response.positions[0]
    assert position.ticker == "AAPL"
    assert position.position_id == "POS-AAPL"
    assert position.stop_price == 95.0
    assert position.shares == 10
    assert position.current_price == pytest.approx(110.0, abs=1e-6)


def test_broker_mode_create_order_submits_to_execution_provider(tmp_path: Path):
    orders_repo, positions_repo = _repos(tmp_path)
    broker = FakeExecutionProvider(orders=[], positions=[])
    service = PortfolioService(
        orders_repo=orders_repo,
        positions_repo=positions_repo,
        provider=_mock_market_provider(),
        execution_provider=broker,
    )

    order = service.create_order(
        CreateOrderRequest(
            ticker="msft",
            order_type="BUY_LIMIT",
            quantity=3,
            limit_price=380.5,
            notes="manual click",
            order_kind="entry",
        )
    )

    assert broker.submitted, "Expected provider submit_order to be called."
    submitted = broker.submitted[-1]
    assert submitted.ticker == "MSFT"
    assert submitted.side == "buy"
    assert submitted.order_type == "limit"
    assert submitted.quantity == 3.0
    assert submitted.limit_price == 380.5
    assert order.order_id.startswith("BROKER-")
    assert order.broker_order_id == order.order_id
    assert order.broker_provider == "fake-broker"


def test_broker_mode_update_stop_cancels_old_stop_and_places_new_one(tmp_path: Path):
    orders_repo, positions_repo = _repos(tmp_path)
    broker = FakeExecutionProvider(
        orders=[
            ExecutionOrder(
                order_id="STOP-TSLA-OLD",
                ticker="TSLA",
                status="pending",
                side="sell",
                order_type="stop",
                quantity=5,
                filled_quantity=0,
                limit_price=None,
                stop_price=180.0,
                tif="gtc",
                submitted_at="2026-02-11T10:01:00",
                filled_at=None,
                avg_fill_price=None,
                client_order_id="STOP-TSLA-OLD",
                raw_status="new",
            )
        ],
        positions=[
            ExecutionPosition(
                ticker="TSLA",
                quantity=5,
                avg_entry_price=200.0,
                current_price=210.0,
                market_value=1050.0,
                unrealized_pl=50.0,
            )
        ],
    )
    service = PortfolioService(
        orders_repo=orders_repo,
        positions_repo=positions_repo,
        provider=_mock_market_provider(),
        execution_provider=broker,
    )

    result = service.update_position_stop("POS-TSLA", UpdateStopRequest(new_stop=185.0, reason="trail"))

    assert "STOP-TSLA-OLD" in result["cancelled_orders"]
    assert result["new_order_id"].startswith("BROKER-")
    assert broker.cancelled == ["STOP-TSLA-OLD"]
    assert broker.submitted, "Expected new stop order submission."
    submitted = broker.submitted[-1]
    assert submitted.ticker == "TSLA"
    assert submitted.side == "sell"
    assert submitted.order_type == "stop"
    assert submitted.stop_price == 185.0
    assert submitted.quantity == 5.0


def test_broker_mode_cancel_order_calls_execution_provider(tmp_path: Path):
    orders_repo, positions_repo = _repos(tmp_path)
    broker = FakeExecutionProvider(
        orders=[
            ExecutionOrder(
                order_id="BROKER-CANCEL-1",
                ticker="NVDA",
                status="pending",
                side="buy",
                order_type="limit",
                quantity=1,
                filled_quantity=0,
                limit_price=800.0,
                stop_price=None,
                tif="gtc",
                submitted_at="2026-02-19T10:00:00",
                filled_at=None,
                avg_fill_price=None,
                client_order_id="BROKER-CANCEL-1",
                raw_status="new",
            )
        ],
        positions=[],
    )
    service = PortfolioService(
        orders_repo=orders_repo,
        positions_repo=positions_repo,
        provider=_mock_market_provider(),
        execution_provider=broker,
    )

    result = service.cancel_order("BROKER-CANCEL-1")
    assert result["status"] == "ok"
    assert broker.cancelled == ["BROKER-CANCEL-1"]


def test_broker_mode_sync_returns_counts_and_can_persist_projection(tmp_path: Path):
    orders_repo, positions_repo = _repos(tmp_path)
    broker = FakeExecutionProvider(
        orders=[
            ExecutionOrder(
                order_id="ENTRY-NFLX",
                ticker="NFLX",
                status="filled",
                side="buy",
                order_type="limit",
                quantity=2,
                filled_quantity=2,
                limit_price=500.0,
                stop_price=None,
                tif="gtc",
                submitted_at="2026-02-19T09:30:00",
                filled_at="2026-02-19T09:31:00",
                avg_fill_price=500.0,
                client_order_id="ENTRY-NFLX",
                raw_status="filled",
            )
        ],
        positions=[
            ExecutionPosition(
                ticker="NFLX",
                quantity=2,
                avg_entry_price=500.0,
                current_price=510.0,
                market_value=1020.0,
                unrealized_pl=20.0,
            )
        ],
    )
    service = PortfolioService(
        orders_repo=orders_repo,
        positions_repo=positions_repo,
        provider=_mock_market_provider(),
        execution_provider=broker,
    )

    sync = service.sync_broker_state(persist_projection=True)
    assert sync.status == "ok"
    assert sync.provider == "fake-broker"
    assert sync.positions == 1
    assert sync.orders == 1
    assert sync.persisted_projection is True

    persisted_positions = positions_repo.read()["positions"]
    assert len(persisted_positions) == 1
    assert persisted_positions[0]["ticker"] == "NFLX"

    persisted_orders = orders_repo.read()["orders"]
    assert len(persisted_orders) == 1
    assert persisted_orders[0]["ticker"] == "NFLX"
    assert persisted_orders[0]["broker_order_id"] == "ENTRY-NFLX"


def test_broker_mode_export_returns_positions_and_orders(tmp_path: Path):
    orders_repo, positions_repo = _repos(tmp_path)
    broker = FakeExecutionProvider(
        orders=[
            ExecutionOrder(
                order_id="ENTRY-AMZN",
                ticker="AMZN",
                status="pending",
                side="buy",
                order_type="limit",
                quantity=1,
                filled_quantity=0,
                limit_price=170.0,
                stop_price=None,
                tif="gtc",
                submitted_at="2026-02-19T09:30:00",
                filled_at=None,
                avg_fill_price=None,
                client_order_id="ENTRY-AMZN",
                raw_status="new",
            )
        ],
        positions=[
            ExecutionPosition(
                ticker="AMZN",
                quantity=1,
                avg_entry_price=168.0,
                current_price=170.0,
                market_value=170.0,
                unrealized_pl=2.0,
            )
        ],
    )
    service = PortfolioService(
        orders_repo=orders_repo,
        positions_repo=positions_repo,
        provider=_mock_market_provider(),
        execution_provider=broker,
    )

    exported = service.export_portfolio_state()
    assert exported.provider == "fake-broker"
    assert exported.counts["positions"] == 1
    assert exported.counts["orders"] == 1
    assert exported.positions[0].ticker == "AMZN"
    assert exported.orders[0].ticker == "AMZN"
