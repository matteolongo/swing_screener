"""Tests for stale-position time-stop nudges."""
from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

import api.dependencies as deps
from api.main import app
from tests.support.state import PortfolioDbState
from swing_screener.utils.date_helpers import market_today


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
    state = PortfolioDbState(tmp_path / "portfolio.db").install(monkeypatch)

    def write_positions(positions: list[dict]) -> None:
        state.write(positions=positions, asof=market_today().isoformat())

    app.dependency_overrides[deps.get_strategy_repo] = lambda: FakeStrategyRepo()
    yield TestClient(app), write_positions
    app.dependency_overrides.pop(deps.get_strategy_repo, None)


def test_position_includes_days_open(client_with_positions):
    client, write_positions = client_with_positions
    write_positions([make_position((market_today() - timedelta(days=20)).isoformat(), r_now=0.0)])

    response = client.get("/api/portfolio/positions")

    assert response.status_code == 200
    position = response.json()["positions"][0]
    assert position["days_open"] >= 20


def test_time_stop_warning_fires_for_old_flat_position(client_with_positions):
    client, write_positions = client_with_positions
    write_positions([make_position((market_today() - timedelta(days=20)).isoformat(), r_now=0.0)])

    response = client.get("/api/portfolio/positions")

    assert response.status_code == 200
    assert response.json()["positions"][0]["time_stop_warning"] is True


def test_time_stop_warning_absent_for_new_profitable_position(client_with_positions):
    client, write_positions = client_with_positions
    write_positions([make_position((market_today() - timedelta(days=5)).isoformat(), r_now=2.0)])

    response = client.get("/api/portfolio/positions")

    assert response.status_code == 200
    assert response.json()["positions"][0]["time_stop_warning"] is False
