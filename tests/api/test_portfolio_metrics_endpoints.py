import json
from unittest.mock import MagicMock

import pandas as pd
import pytest
from fastapi.testclient import TestClient

import api.dependencies
import api.services.portfolio_service as portfolio_service
from api.repositories.config_repo import ConfigRepository
from api.main import app
from swing_screener.data.providers import MarketDataProvider


def _ohlcv_with_closes(closes: dict[str, list[float]]) -> pd.DataFrame:
    idx = pd.date_range("2026-02-07", periods=2, freq="D")
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


def _set_account_size(monkeypatch: pytest.MonkeyPatch, account_size: float) -> None:
    repo = ConfigRepository()
    config = repo.get()
    config.risk.account_size = account_size
    repo.update(config)
    monkeypatch.setattr(api.dependencies, "_config_repository", repo)


def test_position_metrics_endpoint(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    positions_file = tmp_path / "positions.json"
    orders_file = tmp_path / "orders.json"
    positions_file.write_text(
        json.dumps(
            {
                "asof": "2026-02-08",
                "positions": [
                    {
                        "ticker": "VALE",
                        "status": "open",
                        "entry_date": "2026-01-16",
                        "entry_price": 15.89,
                        "stop_price": 14.60,
                        "shares": 6,
                        "position_id": "POS-VALE-1",
                        "initial_risk": 1.29,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    orders_file.write_text(json.dumps({"asof": "2026-02-08", "orders": []}), encoding="utf-8")

    monkeypatch.setattr(api.dependencies, "POSITIONS_FILE", positions_file)
    monkeypatch.setattr(api.dependencies, "ORDERS_FILE", orders_file)

    mock_provider = MagicMock(spec=MarketDataProvider)
    mock_provider.fetch_ohlcv.return_value = _ohlcv_with_closes({"VALE": [16.30, 16.65]})
    mock_provider.get_provider_name.return_value = "mock"
    monkeypatch.setattr(portfolio_service, "get_default_provider", lambda **kwargs: mock_provider)

    client = TestClient(app)
    res = client.get("/api/portfolio/positions/POS-VALE-1/metrics")
    assert res.status_code == 200

    data = res.json()
    assert data["ticker"] == "VALE"
    assert data["pnl"] == pytest.approx(4.56, abs=0.01)
    assert data["pnl_percent"] == pytest.approx(4.78, abs=0.01)
    assert data["r_now"] == pytest.approx(0.59, abs=0.01)
    assert data["entry_value"] == pytest.approx(95.34, abs=0.01)
    assert data["current_value"] == pytest.approx(99.90, abs=0.01)
    assert data["per_share_risk"] == pytest.approx(1.29, abs=0.01)
    assert data["total_risk"] == pytest.approx(7.74, abs=0.01)


def test_portfolio_summary_endpoint(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    positions_file = tmp_path / "positions.json"
    orders_file = tmp_path / "orders.json"
    positions_file.write_text(
        json.dumps(
            {
                "asof": "2026-02-08",
                "positions": [
                    {
                        "ticker": "VALE",
                        "status": "open",
                        "entry_date": "2026-01-16",
                        "entry_price": 15.89,
                        "stop_price": 14.60,
                        "shares": 6,
                        "position_id": "POS-VALE-1",
                        "initial_risk": 1.29,
                    },
                    {
                        "ticker": "MUFG",
                        "status": "open",
                        "entry_date": "2026-02-02",
                        "entry_price": 10.0,
                        "stop_price": 9.0,
                        "shares": 5,
                        "position_id": "POS-MUFG-1",
                        "initial_risk": 1.0,
                    },
                    {
                        "ticker": "INTC",
                        "status": "closed",
                        "entry_date": "2026-01-15",
                        "entry_price": 48.0,
                        "stop_price": 47.0,
                        "shares": 1,
                        "position_id": "POS-INTC-1",
                        "initial_risk": 1.0,
                    },
                ],
            }
        ),
        encoding="utf-8",
    )
    orders_file.write_text(json.dumps({"asof": "2026-02-08", "orders": []}), encoding="utf-8")

    monkeypatch.setattr(api.dependencies, "POSITIONS_FILE", positions_file)
    monkeypatch.setattr(api.dependencies, "ORDERS_FILE", orders_file)
    _set_account_size(monkeypatch, account_size=1000.0)

    mock_provider = MagicMock(spec=MarketDataProvider)
    mock_provider.fetch_ohlcv.return_value = _ohlcv_with_closes(
        {
            "VALE": [16.30, 16.65],
            "MUFG": [10.8, 11.0],
        }
    )
    mock_provider.get_provider_name.return_value = "mock"
    monkeypatch.setattr(portfolio_service, "get_default_provider", lambda **kwargs: mock_provider)

    client = TestClient(app)
    res = client.get("/api/portfolio/summary")
    assert res.status_code == 200

    data = res.json()
    assert data["total_positions"] == 2
    assert data["total_cost_basis"] == pytest.approx(145.34, abs=0.01)
    assert data["total_value"] == pytest.approx(154.90, abs=0.01)
    assert data["total_pnl"] == pytest.approx(9.56, abs=0.01)
    assert data["total_pnl_percent"] == pytest.approx(6.58, abs=0.01)
    assert data["open_risk"] == pytest.approx(12.74, abs=0.01)
    assert data["open_risk_percent"] == pytest.approx(1.274, abs=0.001)
    assert data["account_size"] == 1000.0
    assert data["available_capital"] == pytest.approx(845.10, abs=0.01)


def test_portfolio_summary_endpoint_no_open_positions(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    positions_file = tmp_path / "positions.json"
    orders_file = tmp_path / "orders.json"
    positions_file.write_text(
        json.dumps(
            {
                "asof": "2026-02-08",
                "positions": [
                    {
                        "ticker": "INTC",
                        "status": "closed",
                        "entry_date": "2026-01-15",
                        "entry_price": 48.0,
                        "stop_price": 47.0,
                        "shares": 1,
                        "position_id": "POS-INTC-1",
                        "initial_risk": 1.0,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    orders_file.write_text(json.dumps({"asof": "2026-02-08", "orders": []}), encoding="utf-8")

    monkeypatch.setattr(api.dependencies, "POSITIONS_FILE", positions_file)
    monkeypatch.setattr(api.dependencies, "ORDERS_FILE", orders_file)
    _set_account_size(monkeypatch, account_size=1000.0)

    mock_provider = MagicMock(spec=MarketDataProvider)
    mock_provider.fetch_ohlcv.return_value = _ohlcv_with_closes({"INTC": [48.0, 48.0]})
    mock_provider.get_provider_name.return_value = "mock"
    monkeypatch.setattr(portfolio_service, "get_default_provider", lambda **kwargs: mock_provider)

    client = TestClient(app)
    res = client.get("/api/portfolio/summary")
    assert res.status_code == 200

    data = res.json()
    assert data["total_positions"] == 0
    assert data["total_value"] == 0.0
    assert data["total_cost_basis"] == 0.0
    assert data["total_pnl"] == 0.0
    assert data["open_risk"] == 0.0
    assert data["open_risk_percent"] == 0.0
    assert data["account_size"] == 1000.0
    assert data["available_capital"] == 1000.0
