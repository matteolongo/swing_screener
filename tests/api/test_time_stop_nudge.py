"""Tests for stale-position time-stop nudges."""
from __future__ import annotations

import json
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

import api.dependencies as deps
from api.main import app


class FakeStrategyRepo:
    def get_active_strategy(self) -> dict:
        return {"manage": {"time_stop_days": 15, "time_stop_min_r": 0.5}}


def make_position(entry_date: str, r_now: float) -> dict:
    entry_price = 100.0
    stop_price = 90.0
    return {
        "position_id": "POS-TIME-001",
        "ticker": "TEST",
        "status": "open",
        "entry_date": entry_date,
        "entry_price": entry_price,
        "stop_price": stop_price,
        "shares": 10,
        "initial_risk": None,
        "current_price": entry_price + r_now * (entry_price - stop_price),
        "notes": "",
        "tags": [],
    }


@pytest.fixture
def client_with_positions(tmp_path, monkeypatch):
    positions_file = tmp_path / "positions.json"
    orders_file = tmp_path / "orders.json"

    def write_positions(positions: list[dict]) -> None:
        positions_file.write_text(
            json.dumps({"asof": date.today().isoformat(), "positions": positions}),
            encoding="utf-8",
        )
        orders_file.write_text(json.dumps({"asof": date.today().isoformat(), "orders": []}), encoding="utf-8")

    monkeypatch.setattr(deps, "_positions_path", positions_file)
    monkeypatch.setattr(deps, "_orders_path", orders_file)
    app.dependency_overrides[deps.get_strategy_repo] = lambda: FakeStrategyRepo()
    yield TestClient(app), write_positions
    app.dependency_overrides.pop(deps.get_strategy_repo, None)


def test_position_includes_days_open(client_with_positions):
    client, write_positions = client_with_positions
    write_positions([make_position((date.today() - timedelta(days=20)).isoformat(), r_now=0.0)])

    response = client.get("/api/portfolio/positions")

    assert response.status_code == 200
    position = response.json()["positions"][0]
    assert position["days_open"] >= 20


def test_time_stop_warning_fires_for_old_flat_position(client_with_positions):
    client, write_positions = client_with_positions
    write_positions([make_position((date.today() - timedelta(days=20)).isoformat(), r_now=0.0)])

    response = client.get("/api/portfolio/positions")

    assert response.status_code == 200
    assert response.json()["positions"][0]["time_stop_warning"] is True


def test_time_stop_warning_absent_for_new_profitable_position(client_with_positions):
    client, write_positions = client_with_positions
    write_positions([make_position((date.today() - timedelta(days=5)).isoformat(), r_now=2.0)])

    response = client.get("/api/portfolio/positions")

    assert response.status_code == 200
    assert response.json()["positions"][0]["time_stop_warning"] is False
