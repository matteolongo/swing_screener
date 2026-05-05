"""Tests for trade tagging on position close."""
import json

import pytest
from fastapi.testclient import TestClient

import api.dependencies as deps
from api.main import app


@pytest.fixture
def client_with_open_position(tmp_path, monkeypatch):
    positions_file = tmp_path / "positions.json"
    orders_file = tmp_path / "orders.json"
    positions_file.write_text(json.dumps({
        "asof": "2026-01-01",
        "positions": [{
            "position_id": "POS-TAG-001",
            "ticker": "AAPL",
            "status": "open",
            "entry_date": "2026-01-01",
            "entry_price": 100.0,
            "stop_price": 95.0,
            "shares": 10,
            "initial_risk": 50.0,
            "notes": "",
            "tags": [],
        }],
    }))
    orders_file.write_text(json.dumps({"asof": "2026-01-01", "orders": []}))
    monkeypatch.setattr(deps, "_positions_path", positions_file)
    monkeypatch.setattr(deps, "_orders_path", orders_file)
    return TestClient(app)


def test_close_with_tags_stores_tags(client_with_open_position):
    response = client_with_open_position.post(
        "/api/portfolio/positions/POS-TAG-001/close",
        json={
            "exit_price": 110.0,
            "tags": ["breakout", "stop_hit"],
        },
    )
    assert response.status_code == 200

    resp = client_with_open_position.get("/api/portfolio/positions/POS-TAG-001")
    assert resp.status_code == 200
    assert set(resp.json()["tags"]) == {"breakout", "stop_hit"}


def test_close_without_tags_stores_empty_list(client_with_open_position):
    response = client_with_open_position.post(
        "/api/portfolio/positions/POS-TAG-001/close",
        json={"exit_price": 110.0},
    )
    assert response.status_code == 200

    resp = client_with_open_position.get("/api/portfolio/positions/POS-TAG-001")
    assert resp.json()["tags"] == []
