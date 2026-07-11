from __future__ import annotations
import json
import pytest
from fastapi.testclient import TestClient
from api.main import app


@pytest.fixture()
def client_with_empty_order_book(tmp_path, monkeypatch):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    orders_path.write_text(json.dumps({"orders": [], "asof": "2026-04-25"}))
    positions_path.write_text(json.dumps({"positions": [], "asof": "2026-04-25"}))
    import api.dependencies as deps

    monkeypatch.setattr(deps, "_orders_path", orders_path)
    monkeypatch.setattr(deps, "_positions_path", positions_path)
    return TestClient(app)


def test_create_order_rejects_zero_stop(client_with_empty_order_book):
    resp = client_with_empty_order_book.post(
        "/api/portfolio/orders",
        json={
            "ticker": "SBMO",
            "order_type": "LIMIT",
            "quantity": 200,
            "limit_price": 12.50,
            "stop_price": 0,
        },
    )

    assert resp.status_code == 422


def test_create_order_rejects_stop_at_or_above_limit(client_with_empty_order_book):
    resp = client_with_empty_order_book.post(
        "/api/portfolio/orders",
        json={
            "ticker": "SBMO",
            "order_type": "LIMIT",
            "quantity": 200,
            "limit_price": 12.50,
            "stop_price": 12.50,
        },
    )

    assert resp.status_code == 422


@pytest.fixture()
def client_with_pending_order(tmp_path, monkeypatch):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    orders_path.write_text(json.dumps({
        "orders": [{
            "order_id": "ORD-SBMO-001",
            "ticker": "SBMO",
            "status": "pending",
            "order_kind": "entry",
            "order_type": "LIMIT",
            "quantity": 200,
            "limit_price": 12.50,
            "stop_price": 11.20,
            "order_date": "2026-04-25",
            "filled_date": None,
            "entry_price": None,
            "notes": "",
            "parent_order_id": None,
            "position_id": None,
            "tif": "GTC",
            "fee_eur": None,
            "fill_fx_rate": None,
            "isin": "NL0010273215",
            "thesis": None,
        }],
        "asof": "2026-04-25",
    }))
    positions_path.write_text(json.dumps({"positions": [], "asof": "2026-04-25"}))
    import api.dependencies as deps
    monkeypatch.setattr(deps, "_orders_path", orders_path)
    monkeypatch.setattr(deps, "_positions_path", positions_path)
    return TestClient(app)

def test_fill_order_creates_position(client_with_pending_order):
    resp = client_with_pending_order.post(
        "/api/portfolio/orders/ORD-SBMO-001/fill",
        json={"filled_price": 12.34, "filled_date": "2026-04-26", "fee_eur": 2.10},
    )
    assert resp.status_code == 201
    pos = resp.json()["position"]
    assert pos["ticker"] == "SBMO"
    assert pos["entry_price"] == 12.34
    assert pos["entry_date"] == "2026-04-26"
    assert pos["stop_price"] == 11.20
    assert pos["status"] == "open"
    assert pos["source_order_id"] == "ORD-SBMO-001"
    assert abs(pos["initial_risk"] - (12.34 - 11.20)) < 0.01  # per-share: 1.14

def test_fill_order_already_filled_returns_409(client_with_pending_order):
    first = client_with_pending_order.post(
        "/api/portfolio/orders/ORD-SBMO-001/fill",
        json={"filled_price": 12.34, "filled_date": "2026-04-26"},
    )
    assert first.status_code == 201
    resp = client_with_pending_order.post(
        "/api/portfolio/orders/ORD-SBMO-001/fill",
        json={"filled_price": 12.34, "filled_date": "2026-04-26"},
    )
    assert resp.status_code == 409

def test_fill_order_not_found_returns_404(client_with_pending_order):
    resp = client_with_pending_order.post(
        "/api/portfolio/orders/ORD-MISSING-001/fill",
        json={"filled_price": 12.34, "filled_date": "2026-04-26"},
    )
    assert resp.status_code == 404

def test_list_local_orders_returns_pending(client_with_pending_order):
    resp = client_with_pending_order.get("/api/portfolio/orders/local")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["orders"]) == 1
    assert data["orders"][0]["order_id"] == "ORD-SBMO-001"


def test_cancel_pending_order_marks_cancelled(client_with_pending_order):
    resp = client_with_pending_order.delete("/api/portfolio/orders/ORD-SBMO-001")
    assert resp.status_code == 200
    assert resp.json() == {"order_id": "ORD-SBMO-001", "status": "cancelled"}

    orders_resp = client_with_pending_order.get("/api/portfolio/orders/local")
    assert orders_resp.status_code == 200
    assert orders_resp.json()["orders"][0]["status"] == "cancelled"



@pytest.fixture()
def client_with_target_order(tmp_path, monkeypatch):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    orders_path.write_text(json.dumps({
        "orders": [{
            "order_id": "ORD-SBMO-001",
            "ticker": "SBMO",
            "status": "pending",
            "order_kind": "entry",
            "order_type": "LIMIT",
            "quantity": 200,
            "limit_price": 12.50,
            "stop_price": 11.20,
            "target_price": 15.00,
            "order_date": "2026-04-25",
            "filled_date": None,
            "entry_price": None,
            "notes": "",
            "parent_order_id": None,
            "position_id": None,
            "tif": "GTC",
            "fee_eur": None,
            "fill_fx_rate": None,
            "isin": "NL0010273215",
            "thesis": None,
        }],
        "asof": "2026-04-25",
    }))
    positions_path.write_text(json.dumps({"positions": [], "asof": "2026-04-25"}))
    import api.dependencies as deps
    monkeypatch.setattr(deps, "_orders_path", orders_path)
    monkeypatch.setattr(deps, "_positions_path", positions_path)
    return TestClient(app)


def test_fill_order_carries_target_price_to_position(client_with_target_order):
    resp = client_with_target_order.post(
        "/api/portfolio/orders/ORD-SBMO-001/fill",
        json={"filled_price": 12.34, "filled_date": "2026-04-26"},
    )
    assert resp.status_code == 201
    pos = resp.json()["position"]
    assert pos["target_price"] == 15.00


@pytest.fixture()
def client_with_addon_order(tmp_path, monkeypatch):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    orders_path.write_text(json.dumps({
        "orders": [{
            "order_id": "ORD-SBMO-002",
            "ticker": "SBMO",
            "status": "pending",
            "order_kind": "entry",
            "order_type": "LIMIT",
            "quantity": 50,
            "limit_price": 13.00,
            "stop_price": 11.20,
            "order_date": "2026-04-25",
            "filled_date": None,
            "entry_price": None,
            "notes": "",
            "parent_order_id": None,
            "position_id": "POS-EXIST",
            "tif": "GTC",
            "fee_eur": None,
            "fill_fx_rate": None,
            "isin": "NL0010273215",
            "thesis": None,
        }],
        "asof": "2026-04-25",
    }))
    positions_path.write_text(json.dumps({
        "positions": [{
            "position_id": "POS-EXIST",
            "ticker": "SBMO",
            "status": "open",
            "entry_date": "2026-04-20",
            "entry_price": 12.0,
            "stop_price": 11.0,
            "shares": 100,
            "initial_risk": 1.0,
            "entry_fee_eur": 2.0,
        }],
        "asof": "2026-04-25",
    }))
    import api.dependencies as deps
    monkeypatch.setattr(deps, "_orders_path", orders_path)
    monkeypatch.setattr(deps, "_positions_path", positions_path)
    return TestClient(app)


def test_fill_addon_merges_into_existing_position(client_with_addon_order):
    resp = client_with_addon_order.post(
        "/api/portfolio/orders/ORD-SBMO-002/fill",
        json={"filled_price": 13.00, "filled_date": "2026-04-26", "fee_eur": 1.5},
    )
    assert resp.status_code == 201
    pos = resp.json()["position"]
    # Weighted-average entry, existing stop kept, initial_risk = new_entry - stop.
    assert pos["position_id"] == "POS-EXIST"
    assert pos["shares"] == 150
    assert abs(pos["entry_price"] - (12.0 * 100 + 13.0 * 50) / 150) < 1e-6  # 12.333333
    assert pos["stop_price"] == 11.0
    assert abs(pos["initial_risk"] - (pos["entry_price"] - 11.0)) < 1e-4
    assert abs(pos["entry_fee_eur"] - 3.5) < 1e-6  # 2.0 prior + 1.5 add-on
    # No duplicate position was created.
    positions = client_with_addon_order.get("/api/portfolio/positions").json()["positions"]
    sbmo = [p for p in positions if p["ticker"] == "SBMO"]
    assert len(sbmo) == 1


@pytest.fixture()
def client_with_addon_order_below_live_stop(tmp_path, monkeypatch):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    orders_path.write_text(json.dumps({
        "orders": [{
            "order_id": "ORD-SBMO-003",
            "ticker": "SBMO",
            "status": "pending",
            "order_kind": "entry",
            "order_type": "LIMIT",
            "quantity": 50,
            "limit_price": 8.00,
            "stop_price": 7.00,
            "order_date": "2026-04-25",
            "filled_date": None,
            "entry_price": None,
            "notes": "",
            "parent_order_id": None,
            "position_id": "POS-EXIST",
            "tif": "GTC",
            "fee_eur": None,
            "fill_fx_rate": None,
            "isin": "NL0010273215",
            "thesis": None,
        }],
        "asof": "2026-04-25",
    }))
    positions_path.write_text(json.dumps({
        "positions": [{
            "position_id": "POS-EXIST",
            "ticker": "SBMO",
            "status": "open",
            "entry_date": "2026-04-20",
            "entry_price": 12.0,
            "stop_price": 11.0,
            "shares": 100,
            "initial_risk": 1.0,
        }],
        "asof": "2026-04-25",
    }))
    import api.dependencies as deps

    monkeypatch.setattr(deps, "_orders_path", orders_path)
    monkeypatch.setattr(deps, "_positions_path", positions_path)
    return TestClient(app)


def test_fill_addon_rejects_live_stop_above_blended_entry(
    client_with_addon_order_below_live_stop,
):
    resp = client_with_addon_order_below_live_stop.post(
        "/api/portfolio/orders/ORD-SBMO-003/fill",
        json={"filled_price": 8.00, "filled_date": "2026-04-26"},
    )

    assert resp.status_code == 422
    positions = client_with_addon_order_below_live_stop.get(
        "/api/portfolio/positions"
    ).json()["positions"]
    assert positions[0]["entry_price"] == 12.0
    assert positions[0]["stop_price"] == 11.0
    assert positions[0]["shares"] == 100
