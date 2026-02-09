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
    stop_orders = [o for o in orders if o.get("order_kind") == "stop"]
    assert stop_orders
    stop = stop_orders[0]
    assert stop["ticker"] == "INTC"
    assert stop["status"] == "pending"
    assert stop["stop_price"] == 43.50
