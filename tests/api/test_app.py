from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from swing_screener.api.app import create_app


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def test_get_orders_positions(tmp_path: Path) -> None:
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    _write_json(orders_path, {"asof": "2026-01-21", "orders": []})
    _write_json(positions_path, {"asof": "2026-01-21", "positions": []})

    client = TestClient(create_app(orders_path=orders_path, positions_path=positions_path))
    orders_res = client.get("/orders")
    positions_res = client.get("/positions")

    assert orders_res.status_code == 200
    assert positions_res.status_code == 200
    assert orders_res.json()["orders"] == []
    assert positions_res.json()["positions"] == []


def test_preview_and_apply(tmp_path: Path) -> None:
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    _write_json(
        orders_path,
        {
            "asof": "2026-01-21",
            "orders": [{"order_id": "AAA-1", "ticker": "AAA", "status": "pending"}],
        },
    )
    _write_json(
        positions_path,
        {
            "asof": "2026-01-21",
            "positions": [{"ticker": "AAA", "status": "open", "stop_price": 10.0}],
        },
    )

    client = TestClient(create_app(orders_path=orders_path, positions_path=positions_path))

    preview_res = client.post(
        "/preview",
        json={
            "orders": [{"order_id": "AAA-1", "status": "filled"}],
            "positions": [{"ticker": "AAA", "stop_price": 9.5}],
        },
    )
    assert preview_res.status_code == 200
    diff = preview_res.json()["diff"]
    assert diff["orders"][0]["changes"]["status"] == ["pending", "filled"]
    assert diff["positions"][0]["changes"]["stop_price"] == [10.0, 9.5]

    apply_res = client.post(
        "/apply",
        json={
            "orders": [{"order_id": "AAA-1", "status": "filled"}],
            "positions": [{"ticker": "AAA", "stop_price": 9.5}],
        },
    )
    assert apply_res.status_code == 200

    refreshed = client.get("/orders").json()
    assert refreshed["orders"][0]["status"] == "filled"


def test_patch_order_rejects_locked(tmp_path: Path) -> None:
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    _write_json(
        orders_path,
        {
            "asof": "2026-01-21",
            "orders": [{"order_id": "AAA-1", "ticker": "AAA", "status": "pending", "locked": True}],
        },
    )
    _write_json(
        positions_path,
        {
            "asof": "2026-01-21",
            "positions": [{"ticker": "AAA", "status": "open", "locked": True}],
        },
    )

    client = TestClient(create_app(orders_path=orders_path, positions_path=positions_path))
    res = client.patch("/orders/AAA-1", json={"status": "filled"})
    assert res.status_code == 400
