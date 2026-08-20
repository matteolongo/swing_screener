from __future__ import annotations

from unittest.mock import MagicMock

import pandas as pd
from fastapi.testclient import TestClient

from api.main import app
from swing_screener.data.providers import MarketDataProvider


def _ohlcv(n=160, ticker="AAPL"):
    idx = pd.date_range("2024-01-01", periods=n, freq="B")
    base = [20.0] * (n - 30) + [20.0 + 0.5 * i for i in range(30)]
    close = base[:n]
    high = [c * 1.01 for c in close]
    low = [c * 0.99 for c in close]
    vol = [1000.0] * n
    frames = {
        "Close": pd.DataFrame({ticker: close}, index=idx),
        "High": pd.DataFrame({ticker: high}, index=idx),
        "Low": pd.DataFrame({ticker: low}, index=idx),
        "Volume": pd.DataFrame({ticker: vol}, index=idx),
    }
    combined = pd.concat(frames, axis=1)
    combined.columns = pd.MultiIndex.from_tuples(
        [(f, ticker) for f, _ in combined.columns]
    )
    return combined


def _mock_provider(ohlcv):
    p = MagicMock(spec=MarketDataProvider)
    p.fetch_ohlcv.return_value = ohlcv
    p.get_provider_name.return_value = "mock"
    return p


def test_volume_analysis_happy_path(monkeypatch):
    monkeypatch.setattr(
        "api.routers.market_data.get_market_data_provider",
        lambda *a, **k: _mock_provider(_ohlcv()),
    )
    res = TestClient(app).get("/api/market-data/AAPL/volume-analysis")
    assert res.status_code == 200
    data = res.json()
    assert data["symbol"] == "AAPL"
    assert data["provider"] == "mock"
    assert data["profile_type"] == "approximate_bar_based"
    assert data["action"] in {"Long", "Short", "Watch", "No Trade"}
    assert any("Approximate volume profile" in w for w in data["warnings"])
    assert "poc" in data["key_levels"]
    assert isinstance(data["volume_zones"], list)


def test_volume_analysis_query_params(monkeypatch):
    prov = _mock_provider(_ohlcv())
    monkeypatch.setattr(
        "api.routers.market_data.get_market_data_provider", lambda *a, **k: prov
    )
    res = TestClient(app).get(
        "/api/market-data/AAPL/volume-analysis?interval=1d&lookback=60&min_rr=3"
    )
    assert res.status_code == 200
    assert res.json()["symbol"] == "AAPL"
    assert res.json()["interval"] == "1d"
    assert res.json()["lookback"] == 60
    assert res.json()["min_rr"] == 3.0
    assert prov.fetch_ohlcv.called


def test_volume_analysis_reports_provider_failure(monkeypatch):
    prov = MagicMock(spec=MarketDataProvider)
    prov.fetch_ohlcv.side_effect = RuntimeError("api_key=secret")
    prov.get_provider_name.return_value = "mock"
    monkeypatch.setattr(
        "api.routers.market_data.get_market_data_provider", lambda *a, **k: prov
    )
    res = TestClient(app).get("/api/market-data/AAPL/volume-analysis")

    assert res.status_code == 502
    assert res.json()["detail"] == {
        "code": "market_data_provider_failed",
        "message": "Market data provider failed.",
        "provider": "mock",
    }
    assert "secret" not in res.text


def test_volume_analysis_empty_provider_result_is_valid_absence(monkeypatch):
    monkeypatch.setattr(
        "api.routers.market_data.get_market_data_provider",
        lambda *a, **k: _mock_provider(pd.DataFrame()),
    )

    res = TestClient(app).get("/api/market-data/AAPL/volume-analysis")

    assert res.status_code == 200
    data = res.json()
    assert data["action"] == "No Trade"
    assert data["data_quality"]["ok"] is False
    assert any("Approximate volume profile" in w for w in data["warnings"])
