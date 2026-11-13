"""Open-position pricing must prefer a genuine live quote over a cached daily close.

Regression coverage for a bug where `same_day_cache_ttl_minutes` (tuned for the
post-close screener) let a pre-market daily-bar fetch serve yesterday's close
as "current price" for the rest of the trading session, mislabeled `price_source:
"live"` even though no real-time quote was ever fetched.
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pandas as pd
from fastapi.testclient import TestClient

from api.main import app
from tests.support.state import seed_portfolio
from api.services import portfolio_service
from swing_screener.data.providers import MarketDataProvider

client = TestClient(app)

OPEN_POSITION = {
    "position_id": "POS-LIVE001",
    "ticker": "LRCX",
    "status": "open",
    "entry_date": "2026-06-16",
    "entry_price": 383.04,
    "stop_price": 383.04,
    "shares": 1,
    "initial_risk": 36.74,
}


def _write_positions(monkeypatch, tmp_path: Path, positions: list[dict]) -> None:
    seed_portfolio(monkeypatch, tmp_path, positions=positions, asof="2026-06-30")


def _stale_ohlcv(ticker: str, close: float) -> pd.DataFrame:
    idx = pd.date_range("2026-06-29", periods=2, freq="D")
    data = {
        ("Open", ticker): [close, close],
        ("High", ticker): [close, close],
        ("Low", ticker): [close, close],
        ("Close", ticker): [close, close],
        ("Volume", ticker): [1_000_000, 1_000_000],
    }
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


class TestListPositionsLiveQuote:
    def test_uses_live_quote_over_stale_cached_close(self, tmp_path, monkeypatch):
        _write_positions(monkeypatch, tmp_path, [OPEN_POSITION])

        mock_provider = MagicMock(spec=MarketDataProvider)
        mock_provider.fetch_latest_price.return_value = 396.44  # real-time quote
        mock_provider.fetch_ohlcv.return_value = _stale_ohlcv("LRCX", 433.33)  # stale daily bar
        mock_provider.get_provider_name.return_value = "mock"
        monkeypatch.setattr(portfolio_service, "get_market_data_provider", lambda **kwargs: mock_provider)

        response = client.get("/api/portfolio/positions?status=open")

        assert response.status_code == 200
        positions = response.json()["positions"]
        assert len(positions) == 1
        assert positions[0]["current_price"] == 396.44
        assert positions[0]["price_source"] == "live"

    def test_falls_back_to_cached_close_when_live_quote_fails(self, tmp_path, monkeypatch):
        _write_positions(monkeypatch, tmp_path, [OPEN_POSITION])

        mock_provider = MagicMock(spec=MarketDataProvider)
        mock_provider.fetch_latest_price.side_effect = ConnectionError("no live quote")
        mock_provider.fetch_ohlcv.return_value = _stale_ohlcv("LRCX", 433.33)
        mock_provider.get_provider_name.return_value = "mock"
        monkeypatch.setattr(portfolio_service, "get_market_data_provider", lambda **kwargs: mock_provider)

        response = client.get("/api/portfolio/positions?status=open")

        assert response.status_code == 200
        positions = response.json()["positions"]
        assert positions[0]["current_price"] == 433.33
        assert positions[0]["price_source"] == "cached"


class TestPositionMetricsLiveQuote:
    def test_uses_live_quote_over_stale_cached_close(self, tmp_path, monkeypatch):
        _write_positions(monkeypatch, tmp_path, [OPEN_POSITION])

        mock_provider = MagicMock(spec=MarketDataProvider)
        mock_provider.fetch_latest_price.return_value = 396.44
        mock_provider.fetch_ohlcv.return_value = _stale_ohlcv("LRCX", 433.33)
        mock_provider.get_provider_name.return_value = "mock"
        monkeypatch.setattr(portfolio_service, "get_market_data_provider", lambda **kwargs: mock_provider)

        response = client.get("/api/portfolio/positions/POS-LIVE001/metrics")

        assert response.status_code == 200
        data = response.json()
        assert data["current_value"] == 396.44  # 1 share, so current_value == price used
        assert data["price_source"] == "live"

    def test_falls_back_to_cached_close_when_live_quote_fails(self, tmp_path, monkeypatch):
        _write_positions(monkeypatch, tmp_path, [OPEN_POSITION])

        mock_provider = MagicMock(spec=MarketDataProvider)
        mock_provider.fetch_latest_price.side_effect = ConnectionError("no live quote")
        mock_provider.fetch_ohlcv.return_value = _stale_ohlcv("LRCX", 433.33)
        mock_provider.get_provider_name.return_value = "mock"
        monkeypatch.setattr(portfolio_service, "get_market_data_provider", lambda **kwargs: mock_provider)

        response = client.get("/api/portfolio/positions/POS-LIVE001/metrics")

        assert response.status_code == 200
        data = response.json()
        assert data["price_source"] == "cached"


class TestUnpricedAndClosedPositions:
    def _provider_without_prices(self, monkeypatch):
        mock_provider = MagicMock(spec=MarketDataProvider)
        mock_provider.fetch_latest_price.side_effect = ConnectionError("no live quote")
        mock_provider.fetch_ohlcv.return_value = pd.DataFrame()
        mock_provider.get_provider_name.return_value = "mock"
        monkeypatch.setattr(portfolio_service, "get_market_data_provider", lambda **kwargs: mock_provider)

    def test_list_exposes_entry_price_used_when_no_price_resolves(self, tmp_path, monkeypatch):
        _write_positions(monkeypatch, tmp_path, [OPEN_POSITION])
        self._provider_without_prices(monkeypatch)

        position = client.get("/api/portfolio/positions?status=open").json()["positions"][0]

        assert position["price_source"] == "entry"
        assert position["current_price"] == OPEN_POSITION["entry_price"]

    def test_metrics_label_unpriced_open_position_as_entry(self, tmp_path, monkeypatch):
        _write_positions(monkeypatch, tmp_path, [OPEN_POSITION])
        self._provider_without_prices(monkeypatch)

        data = client.get("/api/portfolio/positions/POS-LIVE001/metrics").json()

        assert data["price_source"] == "entry"

    def test_closed_position_is_labelled_recorded(self, tmp_path, monkeypatch):
        closed = {
            **OPEN_POSITION,
            "position_id": "POS-CLOSED1",
            "status": "closed",
            "exit_price": 400.0,
            "exit_date": "2026-06-20",
        }
        _write_positions(monkeypatch, tmp_path, [closed])
        self._provider_without_prices(monkeypatch)

        listed = client.get("/api/portfolio/positions?status=closed").json()["positions"][0]
        metrics = client.get("/api/portfolio/positions/POS-CLOSED1/metrics").json()

        assert listed["price_source"] == "recorded"
        assert metrics["price_source"] == "recorded"
