"""Tests for FX-adjusted R display on position metrics."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import pandas as pd
from fastapi.testclient import TestClient

import api.dependencies as deps
from api.main import app
from api.services import portfolio_service
from swing_screener.data.providers import MarketDataProvider


client = TestClient(app)


def _ohlcv_with_closes(closes: dict[str, list[float]]) -> pd.DataFrame:
    idx = pd.date_range("2026-01-01", periods=2, freq="D")
    data: dict[tuple[str, str], list[float]] = {}
    for ticker, series in closes.items():
        data[("Open", ticker)] = series
        data[("High", ticker)] = series
        data[("Low", ticker)] = series
        data[("Close", ticker)] = series
        data[("Volume", ticker)] = [1_000_000, 1_000_000]
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def _write_positions(tmp_path: Path, positions: list[dict]) -> Path:
    p = tmp_path / "positions.json"
    p.write_text(json.dumps({"positions": positions, "asof": "2026-01-01"}))
    return p


USD_POSITION = {
    "position_id": "POS-USD001",
    "ticker": "AAPL",
    "status": "open",
    "entry_date": "2026-01-01",
    "entry_price": 100.0,
    "stop_price": 90.0,
    "shares": 10,
    "initial_risk": 100.0,
    "entry_fx_rate": 1.20,
}

EUR_POSITION = {
    "position_id": "POS-EUR001",
    "ticker": "ASML.AS",
    "status": "open",
    "entry_date": "2026-01-01",
    "entry_price": 700.0,
    "stop_price": 670.0,
    "shares": 2,
    "initial_risk": 60.0,
    "entry_fx_rate": None,
}


class TestComputeRFxAdjusted:
    def test_usd_weakened_gives_lower_fx_r(self):
        # EURUSD rose 1.20 → 1.30 (USD weakened), USD gains worth less in EUR
        result = portfolio_service._compute_r_fx_adjusted(
            entry_price=100.0,
            stop_price=90.0,
            current_price=120.0,  # +2R in USD
            entry_eurusd=1.20,
            current_eurusd=1.30,
        )
        assert result is not None
        assert result < 2.0  # FX headwind reduces EUR R

    def test_usd_strengthened_gives_higher_fx_r(self):
        # EURUSD dropped 1.20 → 1.10 (USD strengthened), USD gains worth more in EUR
        result = portfolio_service._compute_r_fx_adjusted(
            entry_price=100.0,
            stop_price=90.0,
            current_price=120.0,  # +2R in USD
            entry_eurusd=1.20,
            current_eurusd=1.10,
        )
        assert result is not None
        assert result > 2.0  # FX tailwind amplifies EUR R

    def test_no_fx_movement_returns_same_r(self):
        result = portfolio_service._compute_r_fx_adjusted(
            entry_price=100.0,
            stop_price=90.0,
            current_price=120.0,
            entry_eurusd=1.20,
            current_eurusd=1.20,
        )
        assert result is not None
        assert abs(result - 2.0) < 0.001

    def test_zero_entry_fx_rate_returns_none(self):
        assert portfolio_service._compute_r_fx_adjusted(100, 90, 120, 0, 1.2) is None

    def test_zero_current_fx_rate_returns_none(self):
        assert portfolio_service._compute_r_fx_adjusted(100, 90, 120, 1.2, 0) is None

    def test_inverted_stop_returns_none(self):
        assert portfolio_service._compute_r_fx_adjusted(100, 100, 120, 1.2, 1.2) is None


class TestFxAdjustedREndpoint:
    def test_usd_position_with_entry_fx_rate_has_r_fx_adjusted(self, tmp_path, monkeypatch):
        pos_file = _write_positions(tmp_path, [USD_POSITION])
        monkeypatch.setattr(deps, "POSITIONS_FILE", pos_file)
        portfolio_service._eurusd_cache.clear()

        mock_provider = MagicMock(spec=MarketDataProvider)

        def mock_fetch(tickers, **kwargs):
            closes = {}
            for t in tickers:
                if t == "EURUSD=X":
                    closes[t] = [1.10, 1.10]
                else:
                    closes[t] = [120.0, 120.0]
            return _ohlcv_with_closes(closes)

        mock_provider.fetch_ohlcv.side_effect = mock_fetch
        mock_provider.get_provider_name.return_value = "mock"
        monkeypatch.setattr(portfolio_service, "get_default_provider", lambda **kwargs: mock_provider)

        response = client.get("/api/portfolio/positions/POS-USD001/metrics")

        assert response.status_code == 200
        data = response.json()
        assert data["r_fx_adjusted"] is not None
        assert data["r_fx_adjusted"] > 2.0  # USD strengthened → more EUR R

    def test_eur_position_returns_null_r_fx_adjusted(self, tmp_path, monkeypatch):
        pos_file = _write_positions(tmp_path, [EUR_POSITION])
        monkeypatch.setattr(deps, "POSITIONS_FILE", pos_file)
        portfolio_service._eurusd_cache.clear()

        mock_provider = MagicMock(spec=MarketDataProvider)
        mock_provider.fetch_ohlcv.return_value = _ohlcv_with_closes({"ASML.AS": [750.0, 750.0]})
        mock_provider.get_provider_name.return_value = "mock"
        monkeypatch.setattr(portfolio_service, "get_default_provider", lambda **kwargs: mock_provider)

        response = client.get("/api/portfolio/positions/POS-EUR001/metrics")

        assert response.status_code == 200
        assert response.json()["r_fx_adjusted"] is None

    def test_usd_position_without_entry_fx_rate_returns_null(self, tmp_path, monkeypatch):
        pos_no_fx = {**USD_POSITION, "position_id": "POS-USD002", "entry_fx_rate": None}
        pos_file = _write_positions(tmp_path, [pos_no_fx])
        monkeypatch.setattr(deps, "POSITIONS_FILE", pos_file)
        portfolio_service._eurusd_cache.clear()

        mock_provider = MagicMock(spec=MarketDataProvider)
        mock_provider.fetch_ohlcv.return_value = _ohlcv_with_closes({"AAPL": [120.0, 120.0]})
        mock_provider.get_provider_name.return_value = "mock"
        monkeypatch.setattr(portfolio_service, "get_default_provider", lambda **kwargs: mock_provider)

        response = client.get("/api/portfolio/positions/POS-USD002/metrics")

        assert response.status_code == 200
        assert response.json()["r_fx_adjusted"] is None

    def test_list_positions_includes_r_fx_adjusted_for_usd(self, tmp_path, monkeypatch):
        pos_file = _write_positions(tmp_path, [USD_POSITION])
        monkeypatch.setattr(deps, "POSITIONS_FILE", pos_file)
        portfolio_service._eurusd_cache.clear()

        mock_provider = MagicMock(spec=MarketDataProvider)

        def mock_fetch(tickers, **kwargs):
            closes = {}
            for t in tickers:
                if t == "EURUSD=X":
                    closes[t] = [1.10, 1.10]
                else:
                    closes[t] = [120.0, 120.0]
            return _ohlcv_with_closes(closes)

        mock_provider.fetch_ohlcv.side_effect = mock_fetch
        mock_provider.get_provider_name.return_value = "mock"
        monkeypatch.setattr(portfolio_service, "get_default_provider", lambda **kwargs: mock_provider)

        response = client.get("/api/portfolio/positions?status=open")

        assert response.status_code == 200
        positions = response.json()["positions"]
        assert len(positions) == 1
        assert positions[0]["r_fx_adjusted"] is not None
