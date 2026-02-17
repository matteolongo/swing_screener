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
    # Provide enough historical data (200+ days) for trailing stop calculation
    idx = pd.date_range("2025-06-01", periods=250, freq="D")
    
    # Create realistic price progression: uptrend from 90 to 110
    prices = pd.Series(range(90, 90 + 250), index=idx)[:250]
    closes = prices.astype(float)
    
    data = {
        ("Close", "AAPL"): closes.values,
        ("Open", "AAPL"): (closes - 1).values,
        ("High", "AAPL"): (closes + 1).values,
        ("Low", "AAPL"): (closes - 2).values,
        ("Volume", "AAPL"): [1_000_000] * len(idx),
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
    # Keep this test focused on breakeven behavior only.
    config_router.current_config.manage.trail_after_r = 999.0
    config_router.current_config.manage.max_holding_days = 999

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
