from __future__ import annotations
import json
import pytest
from fastapi.testclient import TestClient
from api.main import app

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
    assert abs(pos["initial_risk"] - (12.34 - 11.20) * 200) < 0.01  # 228.0

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


def test_fill_from_degiro_creates_position(client_with_pending_order, monkeypatch):
    import api.routers.portfolio as portfolio_router
    import api.services.portfolio_service as svc_module

    class _FakeClient:
        def __init__(self, creds): pass
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def get_order_history(self, from_date, to_date):
            return [{
                "orderId": "DG-BUY-42",
                "productId": "9876",
                "isin": "NL0010273215",
                "product": "SBMO Offshore",
                "buysell": "B",
                "size": 200,
                "price": 12.34,
                "date": "2026-04-26",
                "status": "confirmed",
            }]

    monkeypatch.setattr(portfolio_router, "_check_degiro_available", lambda: None)
    monkeypatch.setattr(svc_module, "DegiroClient", _FakeClient)
    monkeypatch.setattr(svc_module, "load_credentials", lambda: object())

    resp = client_with_pending_order.post(
        "/api/portfolio/orders/ORD-SBMO-001/fill-from-degiro",
        json={"degiro_order_id": "DG-BUY-42"},
    )
    assert resp.status_code == 201
    body = resp.json()
    pos = body["position"]
    assert pos["ticker"] == "SBMO"
    assert pos["entry_price"] == 12.34
    assert pos["entry_date"] == "2026-04-26"
    assert body["broker_order_id"] == "DG-BUY-42"
    assert body["quantity_mismatch"] is False


def test_fill_from_degiro_quantity_mismatch_warns(client_with_pending_order, monkeypatch):
    import api.routers.portfolio as portfolio_router
    import api.services.portfolio_service as svc_module

    class _FakeClient:
        def __init__(self, creds): pass
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def get_order_history(self, from_date, to_date):
            return [{
                "orderId": "DG-BUY-99",
                "productId": "9876",
                "buysell": "B",
                "size": 150,   # mismatch: local order has 200
                "price": 12.34,
                "date": "2026-04-26",
                "status": "confirmed",
            }]

    monkeypatch.setattr(portfolio_router, "_check_degiro_available", lambda: None)
    monkeypatch.setattr(svc_module, "DegiroClient", _FakeClient)
    monkeypatch.setattr(svc_module, "load_credentials", lambda: object())

    resp = client_with_pending_order.post(
        "/api/portfolio/orders/ORD-SBMO-001/fill-from-degiro",
        json={"degiro_order_id": "DG-BUY-99"},
    )
    assert resp.status_code == 201
    assert resp.json()["quantity_mismatch"] is True


def test_fill_from_degiro_not_found_returns_422(client_with_pending_order, monkeypatch):
    import api.routers.portfolio as portfolio_router
    import api.services.portfolio_service as svc_module

    class _FakeClient:
        def __init__(self, creds): pass
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def get_order_history(self, from_date, to_date):
            return []

    monkeypatch.setattr(portfolio_router, "_check_degiro_available", lambda: None)
    monkeypatch.setattr(svc_module, "DegiroClient", _FakeClient)
    monkeypatch.setattr(svc_module, "load_credentials", lambda: object())

    resp = client_with_pending_order.post(
        "/api/portfolio/orders/ORD-SBMO-001/fill-from-degiro",
        json={"degiro_order_id": "DG-NOTFOUND"},
    )
    assert resp.status_code == 422


def test_get_degiro_order_history(monkeypatch):
    """GET /api/portfolio/degiro/order-history returns normalized buy orders."""
    import api.routers.portfolio as portfolio_router
    import api.services.portfolio_service as svc_module

    class _FakeClient:
        def __init__(self, creds): pass
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def get_order_history(self, from_date, to_date):
            return [{
                "orderId": "DG-BUY-1",
                "productId": "12345",
                "isin": "NL0010273215",
                "product": "SBMO Offshore",
                "buysell": "B",
                "size": 200,
                "price": 12.34,
                "date": "2026-04-26T09:14:00",
                "status": "confirmed",
            }]

    monkeypatch.setattr(portfolio_router, "_check_degiro_available", lambda: None)
    monkeypatch.setattr(svc_module, "DegiroClient", _FakeClient)
    monkeypatch.setattr(svc_module, "load_credentials", lambda: object())

    client = TestClient(app)
    resp = client.get("/api/portfolio/degiro/order-history")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["orders"]) == 1
    assert data["orders"][0]["order_id"] == "DG-BUY-1"
    assert data["orders"][0]["side"] == "buy"
    assert data["orders"][0]["price"] == 12.34
