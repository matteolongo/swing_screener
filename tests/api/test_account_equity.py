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


@pytest.fixture
def client_with_partial_close(tmp_path, monkeypatch):
    positions_file = tmp_path / "positions.json"
    orders_file = tmp_path / "orders.json"
    positions_file.write_text(json.dumps({
        "asof": "2026-01-20",
        "positions": [{
            "position_id": "POS-PART",
            "ticker": "NVDA",
            "status": "closed",
            "entry_date": "2026-01-01",
            "entry_price": 10.0,
            "stop_price": 8.0,
            "shares": 40,  # remaining after the partial
            "initial_risk": 2.0,
            "exit_price": 25.0,
            "exit_date": "2026-01-20",
            "partial_closes": [
                {"date": "2026-01-10", "shares_closed": 60, "price": 20.0, "r_at_close": 5.0, "fee_eur": 0.0},
            ],
            "notes": "",
            "tags": [],
        }],
    }))
    orders_file.write_text(json.dumps({"asof": "2026-01-20", "orders": []}))
    monkeypatch.setattr(deps, "_positions_path", positions_file)
    monkeypatch.setattr(deps, "_orders_path", orders_file)
    return TestClient(app)


def test_realized_pnl_includes_partial_close_proceeds(client_with_partial_close):
    data = client_with_partial_close.get("/api/portfolio/summary").json()
    # partial: (20-10)*60 = 600; final: (25-10)*40 = 600; total 1200.
    assert abs(data["realized_pnl"] - 1200.0) < 0.01
