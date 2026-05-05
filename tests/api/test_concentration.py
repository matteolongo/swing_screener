"""Tests for portfolio concentration warnings."""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

import api.dependencies as deps
from api.main import app


POSITIONS = [
    {
        "position_id": "POS-SBMO",
        "ticker": "SBMO.AS",
        "status": "open",
        "entry_date": "2026-01-01",
        "entry_price": 34.0,
        "stop_price": 33.0,
        "shares": 10,
        "initial_risk": 1.0,
        "notes": "",
        "tags": [],
    },
    {
        "position_id": "POS-ALLF",
        "ticker": "ALLF.AS",
        "status": "open",
        "entry_date": "2026-01-01",
        "entry_price": 10.0,
        "stop_price": 9.0,
        "shares": 5,
        "initial_risk": 1.0,
        "notes": "",
        "tags": [],
    },
    {
        "position_id": "POS-AAPL",
        "ticker": "AAPL",
        "status": "open",
        "entry_date": "2026-01-01",
        "entry_price": 100.0,
        "stop_price": 95.0,
        "shares": 1,
        "initial_risk": 5.0,
        "notes": "",
        "tags": [],
    },
]


@pytest.fixture
def client_with_positions(tmp_path, monkeypatch):
    positions_file = tmp_path / "positions.json"
    orders_file = tmp_path / "orders.json"
    positions_file.write_text(json.dumps({"asof": "2026-01-01", "positions": POSITIONS}))
    orders_file.write_text(json.dumps({"asof": "2026-01-01", "orders": []}))
    monkeypatch.setattr(deps, "_positions_path", positions_file)
    monkeypatch.setattr(deps, "_orders_path", orders_file)
    return TestClient(app)


def test_concentration_included_in_summary(client_with_positions):
    response = client_with_positions.get("/api/portfolio/summary")

    assert response.status_code == 200
    data = response.json()
    assert "concentration" in data
    assert len(data["concentration"]) > 0


def test_concentration_correct_pct(client_with_positions):
    response = client_with_positions.get("/api/portfolio/summary")

    data = response.json()
    groups = {group["country"]: group for group in data["concentration"]}
    assert "NL" in groups
    assert abs(groups["NL"]["risk_pct"] - 75.0) < 1.0


def test_concentration_warning_flag_when_above_threshold(client_with_positions):
    response = client_with_positions.get("/api/portfolio/summary")

    data = response.json()
    groups = {group["country"]: group for group in data["concentration"]}
    assert groups["NL"]["warning"] is True
