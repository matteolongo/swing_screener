"""Tests for F13: per-position trail method PATCH endpoint."""
import json
import pytest
from fastapi.testclient import TestClient
from api.main import app
import api.dependencies as deps


@pytest.fixture
def client(tmp_path, monkeypatch):
    pos_file = tmp_path / "positions.json"
    ord_file = tmp_path / "orders.json"
    pos_file.write_text(json.dumps({
        "asof": "2026-01-01",
        "positions": [
            {
                "position_id": "POS-001",
                "ticker": "AAPL",
                "status": "open",
                "entry_date": "2025-12-01",
                "entry_price": 150.0,
                "stop_price": 140.0,
                "shares": 10,
                "initial_risk": 10.0,
            }
        ],
    }))
    ord_file.write_text(json.dumps({"orders": []}))
    monkeypatch.setattr(deps, "_positions_path", pos_file)
    monkeypatch.setattr(deps, "_orders_path", ord_file)
    return TestClient(app)


def test_patch_trail_method_persists(client, tmp_path):
    pos_file = tmp_path / "positions.json"
    response = client.patch(
        "/api/portfolio/positions/POS-001/trail-method",
        json={"trail_method": "atr", "trail_param": 2.5},
    )
    assert response.status_code == 200
    assert response.json()["trail_method"] == "atr"
    stored = json.loads(pos_file.read_text())
    pos = stored["positions"][0]
    assert pos["trail_method"] == "atr"
    assert pos["trail_param"] == 2.5


def test_patch_trail_method_manual(client, tmp_path):
    pos_file = tmp_path / "positions.json"
    response = client.patch(
        "/api/portfolio/positions/POS-001/trail-method",
        json={"trail_method": "manual", "trail_param": None},
    )
    assert response.status_code == 200
    stored = json.loads(pos_file.read_text())
    assert stored["positions"][0]["trail_method"] == "manual"
    assert stored["positions"][0]["trail_param"] is None


def test_patch_trail_method_invalid_value(client):
    response = client.patch(
        "/api/portfolio/positions/POS-001/trail-method",
        json={"trail_method": "unknown_method"},
    )
    assert response.status_code == 422


def test_patch_trail_method_not_found(client):
    response = client.patch(
        "/api/portfolio/positions/DOES-NOT-EXIST/trail-method",
        json={"trail_method": "sma20"},
    )
    assert response.status_code == 404


def test_positions_list_returns_trail_method(client):
    client.patch(
        "/api/portfolio/positions/POS-001/trail-method",
        json={"trail_method": "fixed_pct", "trail_param": 5.0},
    )
    response = client.get("/api/portfolio/positions?status=open")
    assert response.status_code == 200
    positions = response.json()["positions"]
    pos = next(p for p in positions if p["position_id"] == "POS-001")
    assert pos["trail_method"] == "fixed_pct"
    assert pos["trail_param"] == 5.0
