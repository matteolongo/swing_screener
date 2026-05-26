import json

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from api.models.config import AppConfig
from api.main import app
import api.dependencies
import api.services.portfolio_service as portfolio_service
from api.repositories.config_repo import ConfigRepository
from swing_screener.data.providers import MarketDataProvider


def _ohlcv_for_ticker(ticker: str = "AAPL", periods: int = 250) -> pd.DataFrame:
    idx = pd.date_range("2025-06-01", periods=periods, freq="D")
    closes = pd.Series(range(90, 90 + periods), dtype=float).values
    data = {
        ("Close", ticker): closes,
        ("Open", ticker): closes - 1,
        ("High", ticker): closes + 1,
        ("Low", ticker): closes - 2,
        ("Volume", ticker): [1_000_000] * periods,
    }
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def _setup(monkeypatch, tmp_path, stop_price: float = 90.0):
    positions_file = tmp_path / "positions.json"
    positions_data = {
        "asof": "2026-01-01",
        "positions": [
            {
                "ticker": "AAPL",
                "status": "open",
                "entry_date": "2026-01-01",
                "entry_price": 100.0,
                "stop_price": stop_price,
                "shares": 10,
                "position_id": "POS-AAPL-1",
            }
        ],
    }
    positions_file.write_text(json.dumps(positions_data))
    monkeypatch.setattr(api.dependencies, "POSITIONS_FILE", positions_file)

    config = ConfigRepository.get_defaults().model_copy(deep=True)
    config.manage.trail_after_r = 999.0
    config.manage.max_holding_days = 999
    monkeypatch.setattr(
        ConfigRepository, "get", lambda self: AppConfig.model_validate(config.model_dump())
    )
    return positions_file


def _mock_provider(monkeypatch, ohlcv: pd.DataFrame, live_price: float = 110.0):
    mock = MagicMock(spec=MarketDataProvider)
    mock.fetch_ohlcv.return_value = ohlcv
    mock.fetch_latest_price.return_value = live_price
    mock.get_provider_name.return_value = "mock"
    monkeypatch.setattr(portfolio_service, "get_default_provider", lambda *args, **kwargs: mock)
    return mock


def test_stop_preview_raises_stop_when_price_above_trail(monkeypatch, tmp_path):
    _setup(monkeypatch, tmp_path, stop_price=90.0)
    ohlcv = _ohlcv_for_ticker()
    mock = _mock_provider(monkeypatch, ohlcv, live_price=160.0)

    client = TestClient(app)
    res = client.get("/api/portfolio/positions/POS-AAPL-1/stop-preview")
    assert res.status_code == 200
    data = res.json()
    assert data["ticker"] == "AAPL"
    assert data["action"] == "MOVE_STOP_UP"
    assert data["stop_suggested"] > data["stop_old"]
    mock.fetch_latest_price.assert_called_once_with("AAPL")


def test_stop_preview_no_action_when_price_flat(monkeypatch, tmp_path):
    _setup(monkeypatch, tmp_path, stop_price=90.0)
    ohlcv = _ohlcv_for_ticker()
    _mock_provider(monkeypatch, ohlcv, live_price=100.0)

    client = TestClient(app)
    res = client.get("/api/portfolio/positions/POS-AAPL-1/stop-preview")
    assert res.status_code == 200
    data = res.json()
    assert data["action"] == "NO_ACTION"
    assert data["stop_suggested"] == data["stop_old"]


def test_stop_preview_stop_hit(monkeypatch, tmp_path):
    _setup(monkeypatch, tmp_path, stop_price=90.0)
    ohlcv = _ohlcv_for_ticker()
    _mock_provider(monkeypatch, ohlcv, live_price=85.0)

    client = TestClient(app)
    res = client.get("/api/portfolio/positions/POS-AAPL-1/stop-preview")
    assert res.status_code == 200
    data = res.json()
    assert data["action"] == "CLOSE_STOP_HIT"


def test_stop_preview_uses_supplied_price(monkeypatch, tmp_path):
    _setup(monkeypatch, tmp_path, stop_price=90.0)
    ohlcv = _ohlcv_for_ticker()
    mock = _mock_provider(monkeypatch, ohlcv, live_price=999.0)

    supplied_price = 155.0
    client = TestClient(app)
    res = client.get(f"/api/portfolio/positions/POS-AAPL-1/stop-preview?price={supplied_price}")
    assert res.status_code == 200
    data = res.json()
    assert abs(data["last"] - supplied_price) < 0.01
    mock.fetch_latest_price.assert_not_called()


def test_stop_preview_invalid_price_rejected(monkeypatch, tmp_path):
    _setup(monkeypatch, tmp_path)
    client = TestClient(app)
    res = client.get("/api/portfolio/positions/POS-AAPL-1/stop-preview?price=-5")
    assert res.status_code == 422


def test_stop_preview_position_not_found(monkeypatch, tmp_path):
    _setup(monkeypatch, tmp_path)
    client = TestClient(app)
    res = client.get("/api/portfolio/positions/NONEXISTENT/stop-preview")
    assert res.status_code == 404


def test_stop_preview_closed_position_rejected(monkeypatch, tmp_path):
    positions_file = tmp_path / "positions.json"
    positions_data = {
        "asof": "2026-01-01",
        "positions": [
            {
                "ticker": "AAPL",
                "status": "closed",
                "entry_date": "2026-01-01",
                "entry_price": 100.0,
                "stop_price": 90.0,
                "shares": 10,
                "position_id": "POS-CLOSED-1",
                "exit_price": 110.0,
                "exit_date": "2026-02-01",
            }
        ],
    }
    positions_file.write_text(json.dumps(positions_data))
    monkeypatch.setattr(api.dependencies, "POSITIONS_FILE", positions_file)

    client = TestClient(app)
    res = client.get("/api/portfolio/positions/POS-CLOSED-1/stop-preview")
    assert res.status_code == 400
