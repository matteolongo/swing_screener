import json

from fastapi.testclient import TestClient

import api.dependencies as deps
from api.main import app


def _seed_files(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    positions_path = data_dir / "positions.json"
    orders_path = data_dir / "orders.json"

    positions_path.write_text(
        json.dumps({"asof": "2026-02-08", "positions": []}, indent=2),
        encoding="utf-8",
    )
    orders_path.write_text(
        json.dumps(
            {
                "asof": "2026-02-08",
                "orders": [
                    {
                        "order_id": "ORD-INTC-ENTRY",
                        "ticker": "INTC",
                        "status": "pending",
                        "order_type": "BUY_LIMIT",
                        "quantity": 1,
                        "limit_price": 50.59,
                        "stop_price": 42.97,
                        "order_date": "2026-02-08",
                        "filled_date": "",
                        "entry_price": None,
                        "notes": "From screener",
                        "order_kind": "entry",
                        "parent_order_id": None,
                        "position_id": None,
                        "tif": "GTC",
                    }
                ],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    return positions_path, orders_path


def _seed_exit_fill_files(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    positions_path = data_dir / "positions.json"
    orders_path = data_dir / "orders.json"

    positions_path.write_text(
        json.dumps(
            {
                "asof": "2026-02-18",
                "positions": [
                    {
                        "ticker": "INTC",
                        "status": "open",
                        "position_id": "POS-INTC-1",
                        "source_order_id": "ORD-INTC-ENTRY",
                        "entry_date": "2026-02-09",
                        "entry_price": 49.55,
                        "stop_price": 42.97,
                        "shares": 1,
                        "initial_risk": 6.58,
                        "max_favorable_price": 49.55,
                        "exit_date": None,
                        "exit_price": None,
                        "notes": "",
                        "exit_order_ids": ["ORD-STOP-POS-INTC-1", "ORD-TP-POS-INTC-1"],
                    }
                ],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    orders_path.write_text(
        json.dumps(
            {
                "asof": "2026-02-18",
                "orders": [
                    {
                        "order_id": "ORD-INTC-ENTRY",
                        "ticker": "INTC",
                        "status": "filled",
                        "order_type": "BUY_LIMIT",
                        "quantity": 1,
                        "limit_price": 49.55,
                        "stop_price": None,
                        "order_date": "2026-02-09",
                        "filled_date": "2026-02-09",
                        "entry_price": 49.55,
                        "notes": "",
                        "order_kind": "entry",
                        "parent_order_id": None,
                        "position_id": "POS-INTC-1",
                        "tif": "GTC",
                    },
                    {
                        "order_id": "ORD-STOP-POS-INTC-1",
                        "ticker": "INTC",
                        "status": "pending",
                        "order_type": "SELL_STOP",
                        "quantity": 1,
                        "limit_price": None,
                        "stop_price": 42.97,
                        "order_date": "2026-02-09",
                        "filled_date": "",
                        "entry_price": None,
                        "notes": "",
                        "order_kind": "stop",
                        "parent_order_id": "ORD-INTC-ENTRY",
                        "position_id": "POS-INTC-1",
                        "tif": "GTC",
                    },
                    {
                        "order_id": "ORD-TP-POS-INTC-1",
                        "ticker": "INTC",
                        "status": "pending",
                        "order_type": "SELL_LIMIT",
                        "quantity": 1,
                        "limit_price": 56.0,
                        "stop_price": None,
                        "order_date": "2026-02-09",
                        "filled_date": "",
                        "entry_price": None,
                        "notes": "",
                        "order_kind": "take_profit",
                        "parent_order_id": "ORD-INTC-ENTRY",
                        "position_id": "POS-INTC-1",
                        "tif": "GTC",
                    },
                ],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    return positions_path, orders_path


def test_fill_entry_creates_position_and_stop(monkeypatch, tmp_path):
    positions_path, orders_path = _seed_files(tmp_path)

    monkeypatch.setattr(deps, "POSITIONS_FILE", positions_path)
    monkeypatch.setattr(deps, "ORDERS_FILE", orders_path)

    client = TestClient(app)
    res = client.post(
        "/api/portfolio/orders/ORD-INTC-ENTRY/fill",
        json={
            "filled_price": 50.59,
            "filled_date": "2026-02-09",
            "stop_price": 43.50,
            "fee_eur": 2.10,
            "fill_fx_rate": 1.1916,
        },
    )
    assert res.status_code == 200

    positions = json.loads(positions_path.read_text(encoding="utf-8"))["positions"]
    assert len(positions) == 1
    pos = positions[0]
    assert pos["ticker"] == "INTC"
    assert pos["status"] == "open"
    assert pos["entry_price"] == 50.59
    assert pos["stop_price"] == 43.50
    assert pos["source_order_id"] == "ORD-INTC-ENTRY"

    orders = json.loads(orders_path.read_text(encoding="utf-8"))["orders"]
    entry_orders = [o for o in orders if o.get("order_id") == "ORD-INTC-ENTRY"]
    assert entry_orders
    assert entry_orders[0]["fee_eur"] == 2.10
    assert entry_orders[0]["fill_fx_rate"] == 1.1916
    stop_orders = [o for o in orders if o.get("order_kind") == "stop"]
    assert stop_orders
    stop = stop_orders[0]
    assert stop["ticker"] == "INTC"
    assert stop["status"] == "pending"
    assert stop["stop_price"] == 43.50


def test_fill_exit_order_closes_position_and_cancels_sibling(monkeypatch, tmp_path):
    positions_path, orders_path = _seed_exit_fill_files(tmp_path)

    monkeypatch.setattr(deps, "POSITIONS_FILE", positions_path)
    monkeypatch.setattr(deps, "ORDERS_FILE", orders_path)

    client = TestClient(app)
    res = client.post(
        "/api/portfolio/orders/ORD-STOP-POS-INTC-1/fill",
        json={
            "filled_price": 42.90,
            "filled_date": "2026-02-19",
            "fee_eur": 2.00,
            "fill_fx_rate": 1.18,
        },
    )
    assert res.status_code == 200

    positions = json.loads(positions_path.read_text(encoding="utf-8"))["positions"]
    assert len(positions) == 1
    pos = positions[0]
    assert pos["status"] == "closed"
    assert pos["exit_date"] == "2026-02-19"
    assert pos["exit_price"] == 42.90

    orders = json.loads(orders_path.read_text(encoding="utf-8"))["orders"]
    stop = next(o for o in orders if o["order_id"] == "ORD-STOP-POS-INTC-1")
    tp = next(o for o in orders if o["order_id"] == "ORD-TP-POS-INTC-1")
    assert stop["status"] == "filled"
    assert stop["fee_eur"] == 2.00
    assert stop["fill_fx_rate"] == 1.18
    assert tp["status"] == "cancelled"
