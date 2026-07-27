from __future__ import annotations

from datetime import datetime

from fastapi.testclient import TestClient

from api.main import app
from tests.api.test_volume_analysis_endpoint import _mock_provider, _ohlcv


def test_candles_expose_their_own_provider_and_times(monkeypatch):
    provider = _mock_provider(_ohlcv(n=3))
    monkeypatch.setattr(
        "api.routers.market_data.get_default_provider", lambda *a, **k: provider
    )

    response = TestClient(app).get("/api/market-data/aapl/candles?interval=1d")

    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "AAPL"
    assert data["provider"] == "mock"
    assert data["interval"] == "1d"
    assert data["data_as_of"] == "2024-01-03"
    assert datetime.fromisoformat(data["fetched_at"]).tzinfo is not None
    assert provider.fetch_ohlcv.call_args.kwargs["interval"] == "1d"


def test_empty_candles_keep_truthful_provenance_with_no_content_time(monkeypatch):
    provider = _mock_provider(None)
    monkeypatch.setattr(
        "api.routers.market_data.get_default_provider", lambda *a, **k: provider
    )

    response = TestClient(app).get("/api/market-data/AAPL/candles")

    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "mock"
    assert data["interval"] == "1d"
    assert data["data_as_of"] is None
    assert datetime.fromisoformat(data["fetched_at"]).tzinfo is not None
