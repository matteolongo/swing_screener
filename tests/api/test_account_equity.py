"""Tests for account equity auto-update feature."""
import json

import pytest
from fastapi.testclient import TestClient

import api.dependencies as deps
from api.main import app


POSITIONS = [
    {
        "position_id": "POS-001",
        "ticker": "AAPL",
        "status": "closed",
        "entry_date": "2026-01-01",
        "entry_price": 100.0,
        "stop_price": 95.0,
        "shares": 10,
        "initial_risk": 50.0,
        "exit_price": 120.0,
        "exit_date": "2026-01-15",
        "notes": "",
        "tags": [],
    },
    {
        "position_id": "POS-002",
        "ticker": "MSFT",
        "status": "closed",
        "entry_date": "2026-01-05",
        "entry_price": 200.0,
        "stop_price": 190.0,
        "shares": 5,
        "initial_risk": 50.0,
        "exit_price": 185.0,
        "exit_date": "2026-01-20",
        "notes": "",
        "tags": [],
    },
]


@pytest.fixture
def client_with_closed_positions(tmp_path, monkeypatch):
    positions_file = tmp_path / "positions.json"
    orders_file = tmp_path / "orders.json"
    positions_file.write_text(json.dumps({"asof": "2026-01-20", "positions": POSITIONS}))
    orders_file.write_text(json.dumps({"asof": "2026-01-20", "orders": []}))
    monkeypatch.setattr(deps, "_positions_path", positions_file)
    monkeypatch.setattr(deps, "_orders_path", orders_file)
    return TestClient(app)


def test_portfolio_summary_includes_realized_pnl(client_with_closed_positions):
    response = client_with_closed_positions.get("/api/portfolio/summary")

    assert response.status_code == 200
    data = response.json()
    assert "realized_pnl" in data
    assert abs(data["realized_pnl"] - 125.0) < 0.01


def test_portfolio_summary_includes_effective_account_size(client_with_closed_positions):
    response = client_with_closed_positions.get("/api/portfolio/summary")

    data = response.json()
    assert "effective_account_size" in data
    assert data["effective_account_size"] > data["account_size"]
    assert abs(data["effective_account_size"] - (data["account_size"] + 125.0)) < 0.01
