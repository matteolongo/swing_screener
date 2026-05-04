"""Tests for watchlist pipeline endpoint."""
from __future__ import annotations
import json
from unittest.mock import patch
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from api.main import app
import api.dependencies as deps

WATCHLIST_ITEMS = [
    {"ticker": "AAPL", "watched_at": "2026-01-01T00:00:00+00:00", "watch_price": 180.0, "currency": "USD", "source": "screener"},
    {"ticker": "SBMO.AS", "watched_at": "2026-01-01T00:00:00+00:00", "watch_price": 34.0, "currency": "EUR", "source": "screener"},
]


@pytest.fixture
def client_with_watchlist(tmp_path, monkeypatch):
    watchlist_file = tmp_path / "watchlist.json"
    watchlist_file.write_text(json.dumps({"items": WATCHLIST_ITEMS}))
    monkeypatch.setattr(deps, "_watchlist_path", watchlist_file)
    return TestClient(app)


def _make_ohlcv(tickers: list[str], n_bars: int = 30) -> pd.DataFrame:
    """Build a minimal MultiIndex OHLCV DataFrame."""
    dates = pd.bdate_range(end="2026-01-01", periods=n_bars)
    arrays = []
    for ticker in tickers:
        price = 180.0 if "AAPL" in ticker else 34.0
        prices = price + np.random.randn(n_bars) * 0.5
        vols = np.full(n_bars, 1_000_000.0)
        arrays.append(pd.DataFrame({
            ("Close", ticker): prices,
            ("Volume", ticker): vols,
        }, index=dates))
    return pd.concat(arrays, axis=1)


def test_pipeline_returns_200(client_with_watchlist):
    ohlcv = _make_ohlcv(["AAPL", "SBMO.AS"])
    with patch(
        "api.services.portfolio_service.PortfolioService._fetch_ohlcv_for_tickers",
        return_value=ohlcv,
    ):
        response = client_with_watchlist.get("/api/watchlist/pipeline")
    assert response.status_code == 200


def test_pipeline_returns_items_for_each_watchlist_ticker(client_with_watchlist):
    ohlcv = _make_ohlcv(["AAPL", "SBMO.AS"])
    with patch(
        "api.services.portfolio_service.PortfolioService._fetch_ohlcv_for_tickers",
        return_value=ohlcv,
    ):
        data = client_with_watchlist.get("/api/watchlist/pipeline").json()
    tickers = [item["ticker"] for item in data["items"]]
    assert "AAPL" in tickers
    assert "SBMO.AS" in tickers


def test_pipeline_items_sorted_by_distance_ascending(client_with_watchlist):
    """Items closest to trigger zone (lowest distance_pct) appear first."""
    ohlcv = _make_ohlcv(["AAPL", "SBMO.AS"])
    with patch(
        "api.services.portfolio_service.PortfolioService._fetch_ohlcv_for_tickers",
        return_value=ohlcv,
    ):
        data = client_with_watchlist.get("/api/watchlist/pipeline").json()
    distances = [item["distance_pct"] for item in data["items"] if item["distance_pct"] is not None]
    assert distances == sorted(distances)


def test_pipeline_item_has_required_fields(client_with_watchlist):
    ohlcv = _make_ohlcv(["AAPL", "SBMO.AS"])
    with patch(
        "api.services.portfolio_service.PortfolioService._fetch_ohlcv_for_tickers",
        return_value=ohlcv,
    ):
        data = client_with_watchlist.get("/api/watchlist/pipeline").json()
    item = data["items"][0]
    for field in ("ticker", "current_price", "signal", "trigger_price", "distance_pct", "sparkline"):
        assert field in item, f"Missing field: {field}"


def test_pipeline_empty_watchlist_returns_empty(tmp_path, monkeypatch):
    watchlist_file = tmp_path / "watchlist.json"
    watchlist_file.write_text(json.dumps({"items": []}))
    monkeypatch.setattr(deps, "_watchlist_path", watchlist_file)
    client = TestClient(app)
    response = client.get("/api/watchlist/pipeline")
    assert response.status_code == 200
    assert response.json()["items"] == []
