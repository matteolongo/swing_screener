"""Tests for GET /api/portfolio/symbol-history/{ticker}."""
from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

import api.dependencies as deps
import api.services.portfolio_service as portfolio_service_module
from api.main import app
from swing_screener.data.providers import MarketDataProvider


def _seed_positions(tmp_path, positions: list[dict]) -> object:
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    path = data_dir / "positions.json"
    path.write_text(
        json.dumps({"asof": "2026-04-20", "positions": positions}),
        encoding="utf-8",
    )
    return path


def _mock_provider() -> MagicMock:
    provider = MagicMock(spec=MarketDataProvider)
    provider.fetch_ohlcv.return_value = __import__("pandas").DataFrame()
    provider.get_provider_name.return_value = "mock"
    return provider


def test_symbol_history_returns_200(monkeypatch, tmp_path):
    path = _seed_positions(tmp_path, [
        {
            "ticker": "AAPL",
            "status": "closed",
            "entry_date": "2026-01-10",
            "entry_price": 100.0,
            "stop_price": 95.0,
            "shares": 5,
            "exit_date": "2026-02-01",
            "exit_price": 112.0,
            "notes": "",
        }
    ])
    monkeypatch.setattr(deps, "POSITIONS_FILE", path)
    monkeypatch.setattr(
        portfolio_service_module, "get_default_provider", lambda **kw: _mock_provider()
    )

    client = TestClient(app)
    resp = client.get("/api/portfolio/symbol-history/AAPL")

    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "AAPL"
    assert data["closed_count"] == 1
    assert data["open_count"] == 0
    assert len(data["positions"]) == 1


def test_symbol_history_normalizes_ticker_to_uppercase(monkeypatch, tmp_path):
    path = _seed_positions(tmp_path, [
        {
            "ticker": "AAPL",
            "status": "open",
            "entry_date": "2026-03-01",
            "entry_price": 150.0,
            "stop_price": 145.0,
            "shares": 10,
            "notes": "",
        }
    ])
    monkeypatch.setattr(deps, "POSITIONS_FILE", path)
    monkeypatch.setattr(
        portfolio_service_module, "get_default_provider", lambda **kw: _mock_provider()
    )

    client = TestClient(app)
    resp = client.get("/api/portfolio/symbol-history/aapl")

    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "AAPL"


def test_symbol_history_returns_empty_for_unknown_ticker(monkeypatch, tmp_path):
    path = _seed_positions(tmp_path, [
        {
            "ticker": "TSLA",
            "status": "open",
            "entry_date": "2026-03-01",
            "entry_price": 200.0,
            "stop_price": 190.0,
            "shares": 5,
            "notes": "",
        }
    ])
    monkeypatch.setattr(deps, "POSITIONS_FILE", path)
    monkeypatch.setattr(
        portfolio_service_module, "get_default_provider", lambda **kw: _mock_provider()
    )

    client = TestClient(app)
    resp = client.get("/api/portfolio/symbol-history/AAPL")

    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "AAPL"
    assert data["positions"] == []
    assert data["open_count"] == 0
    assert data["closed_count"] == 0


def test_symbol_history_orders_by_entry_date_descending(monkeypatch, tmp_path):
    path = _seed_positions(tmp_path, [
        {
            "ticker": "AAPL",
            "status": "closed",
            "entry_date": "2025-06-01",
            "entry_price": 120.0,
            "stop_price": 115.0,
            "shares": 10,
            "exit_date": "2025-07-01",
            "exit_price": 130.0,
            "notes": "older",
        },
        {
            "ticker": "AAPL",
            "status": "closed",
            "entry_date": "2026-01-10",
            "entry_price": 100.0,
            "stop_price": 95.0,
            "shares": 5,
            "exit_date": "2026-02-01",
            "exit_price": 112.0,
            "notes": "newer",
        },
    ])
    monkeypatch.setattr(deps, "POSITIONS_FILE", path)
    monkeypatch.setattr(
        portfolio_service_module, "get_default_provider", lambda **kw: _mock_provider()
    )

    client = TestClient(app)
    resp = client.get("/api/portfolio/symbol-history/AAPL")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["positions"]) == 2
    assert data["positions"][0]["entry_date"] == "2026-01-10"
    assert data["positions"][1]["entry_date"] == "2025-06-01"
    assert data["closed_count"] == 2
