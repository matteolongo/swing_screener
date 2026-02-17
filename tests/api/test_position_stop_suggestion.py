import json

import pandas as pd
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from api.main import app
import api.dependencies
import api.routers.config as config_router
import api.services.portfolio_service as portfolio_service
from swing_screener.data.providers import MarketDataProvider

def _ohlcv_for_ticker() -> pd.DataFrame:
    idx = pd.date_range("2026-01-01", periods=3, freq="D")
    data = {
        ("Close", "AAPL"): [100.0, 105.0, 110.0],
        ("Open", "AAPL"): [99.0, 104.0, 109.0],
        ("High", "AAPL"): [101.0, 106.0, 111.0],
        ("Low", "AAPL"): [98.0, 103.0, 108.0],
        ("Volume", "AAPL"): [1_000_000, 1_100_000, 1_050_000],
    }
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df

def test_position_stop_suggestion(monkeypatch, tmp_path):
    positions_file = tmp_path / "positions.json"
    positions_data = {
        "asof": "2026-02-08",
        "positions": [
            {
                "ticker": "AAPL",
                "status": "open",
                "entry_date": "2026-01-01",
                "entry_price": 100.0,
                "stop_price": 90.0,
                "shares": 10,
                "position_id": "POS-AAPL-1",
            }
        ],
    }
    positions_file.write_text(json.dumps(positions_data))

    config_router.current_config = config_router.DEFAULT_CONFIG.model_copy(deep=True)

    def fake_fetch_ohlcv(tickers, cfg):
        return _ohlcv_for_ticker()

    monkeypatch.setattr(api.dependencies, "POSITIONS_FILE", positions_file)
    # Mock the provider
    ohlcv = _ohlcv_for_ticker()
    mock_provider = MagicMock(spec=MarketDataProvider)
    mock_provider.fetch_ohlcv.return_value = ohlcv
    mock_provider.get_provider_name.return_value = "mock"
    monkeypatch.setattr(portfolio_service, "get_default_provider", lambda *args, **kwargs: mock_provider)

    client = TestClient(app)
    res = client.get("/api/portfolio/positions/POS-AAPL-1/stop-suggestion")
    assert res.status_code == 200
    data = res.json()
    assert data["ticker"] == "AAPL"
    assert data["stop_old"] == 90.0
    assert data["stop_suggested"] == 100.0
    assert data["action"] == "MOVE_STOP_UP"