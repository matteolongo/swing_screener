from datetime import datetime

from ui.helpers import (
    load_orders,
    make_order_entry,
    orders_to_dataframe,
    save_orders,
    orders_dicts_to_models,
    orders_models_to_dicts,
)
from swing_screener.execution.orders_service import fill_exit_order_dicts
from swing_screener.portfolio.state import Position


def test_orders_roundtrip(tmp_path):
    path = tmp_path / "orders.json"
    orders = [
        {
            "order_id": "AAPL-1",
            "ticker": "aapl",
            "status": "PENDING",
            "order_type": "buy_limit",
            "limit_price": 101.5,
            "quantity": 3,
            "stop_price": 97.0,
            "order_date": "2024-01-10",
            "filled_date": "",
            "entry_price": None,
            "commission": 1.2,
            "notes": "test",
        }
    ]

    save_orders(path, orders, asof="2024-01-11")
    loaded = load_orders(path)

    assert loaded[0]["ticker"] == "AAPL"
    assert loaded[0]["status"] == "pending"
    assert loaded[0]["order_type"] == "BUY_LIMIT"
    assert loaded[0]["commission"] == 1.2

    df = orders_to_dataframe(loaded)
    assert not df.empty
    assert "order_id" in df.columns


def test_make_order_entry_deterministic():
    now = datetime(2024, 1, 2, 3, 4, 5)
    order = make_order_entry(
        ticker="AAPL",
        order_type="BUY_LIMIT",
        limit_price=100.0,
        quantity=2,
        stop_price=95.0,
        notes="note",
        now=now,
    )
    assert order["order_id"] == "AAPL-20240102030405"
    assert order["order_date"] == "2024-01-02"
    assert order["status"] == "pending"
    assert order["commission"] is None


def test_make_order_entry_allows_missing_stop():
    order = make_order_entry(
        ticker="MSFT",
        order_type="BUY_LIMIT",
        limit_price=200.0,
        quantity=1,
        stop_price=None,
    )
    assert order["stop_price"] is None


def test_order_model_roundtrip():
    orders = [
        {
            "order_id": "AAPL-1",
            "ticker": "AAPL",
            "status": "pending",
            "order_kind": "entry",
            "order_type": "BUY_LIMIT",
            "limit_price": 10.0,
            "quantity": 2,
            "stop_price": 9.0,
            "order_date": "2026-01-10",
            "filled_date": "",
            "entry_price": None,
            "position_id": None,
            "parent_order_id": None,
            "tif": "GTC",
            "notes": "test",
        }
    ]
    models = orders_dicts_to_models(orders)
    out = orders_models_to_dicts(models)
    assert out[0]["order_id"] == "AAPL-1"
    assert out[0]["order_type"] == "BUY_LIMIT"
    assert out[0]["limit_price"] == 10.0
    assert out[0]["stop_price"] == 9.0


def test_fill_exit_order_closes_position():
    orders = [
        {
            "order_id": "ORD-STOP-POS-AAA-20260110-01",
            "ticker": "AAA",
            "status": "pending",
            "order_type": "SELL_STOP",
            "quantity": 5,
            "stop_price": 9.0,
            "order_kind": "stop",
            "position_id": "POS-AAA-20260110-01",
        }
    ]
    positions = [
        Position(
            ticker="AAA",
            status="open",
            position_id="POS-AAA-20260110-01",
            entry_date="2026-01-10",
            entry_price=10.0,
            stop_price=9.0,
            shares=5,
        )
    ]

    new_orders, new_positions = fill_exit_order_dicts(
        orders,
        positions,
        order_id="ORD-STOP-POS-AAA-20260110-01",
        fill_price=8.5,
        fill_date="2026-02-03",
    )

    assert new_orders[0]["status"] == "filled"
    assert new_orders[0]["filled_date"] == "2026-02-03"
    assert new_orders[0]["entry_price"] == 8.5

    pos = new_positions[0]
    assert pos.status == "closed"
    assert pos.exit_date == "2026-02-03"
    assert pos.exit_price == 8.5
