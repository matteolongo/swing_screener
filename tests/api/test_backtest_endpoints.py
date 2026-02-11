import pandas as pd
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from api.main import app
import api.services.backtest_service as backtest_service
from swing_screener.data.providers import MarketDataProvider
from swing_screener.backtest import storage as backtest_storage


def _make_ohlcv(ticker: str = "AAA") -> pd.DataFrame:
    idx = pd.date_range("2024-01-01", periods=5, freq="D")
    close = pd.Series([10, 11, 12, 12, 12], index=idx, dtype=float)
    open_ = close.copy()
    high = close + 0.5
    low = close - 0.5
    vol = pd.Series(1_000_000, index=idx, dtype=float)

    data = {
        ("Open", ticker): open_,
        ("High", ticker): high,
        ("Low", ticker): low,
        ("Close", ticker): close,
        ("Volume", ticker): vol,
    }
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def _base_payload():
    return {
        "tickers": ["AAA"],
        "start": "2024-01-01",
        "end": "2024-02-01",
        "entry_type": "breakout",
        "breakout_lookback": 2,
        "pullback_ma": 2,
        "min_history": 1,
        "atr_window": 1,
        "k_atr": 1.0,
        "breakeven_at_r": 10.0,
        "trail_after_r": 10.0,
        "trail_sma": 2,
        "sma_buffer_pct": 0.0,
        "max_holding_days": 1,
        "commission_pct": 0.0,
    }


def test_full_backtest_run_and_simulation_flow(monkeypatch, tmp_path):
    ohlcv = _make_ohlcv("AAA")

    def fake_fetch_ohlcv(tickers, cfg, use_cache=True, force_refresh=False):
        return ohlcv

    # Mock the provider
    mock_provider = MagicMock(spec=MarketDataProvider)
    mock_provider.fetch_ohlcv.return_value = ohlcv
    mock_provider.get_provider_name.return_value = "mock"
    monkeypatch.setattr(backtest_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(backtest_storage, "BACKTEST_DIR", tmp_path / "backtests")

    client = TestClient(app)
    payload = _base_payload()

    run_res = client.post("/api/backtest/run", json=payload)
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data["summary"]["trades"] == 1
    sim_id = run_data["simulation_id"]
    assert sim_id

    list_res = client.get("/api/backtest/simulations")
    assert list_res.status_code == 200
    sims = list_res.json()
    assert any(s["id"] == sim_id for s in sims)

    get_res = client.get(f"/api/backtest/simulations/{sim_id}")
    assert get_res.status_code == 200
    sim_data = get_res.json()
    assert sim_data["id"] == sim_id

    del_res = client.delete(f"/api/backtest/simulations/{sim_id}")
    assert del_res.status_code == 200

    missing_res = client.get(f"/api/backtest/simulations/{sim_id}")
    assert missing_res.status_code == 404


def test_full_backtest_null_summary_when_no_trades(monkeypatch, tmp_path):
    ohlcv = _make_ohlcv("AAA")

    def fake_fetch_ohlcv(tickers, cfg, use_cache=True, force_refresh=False):
        return ohlcv

    # Mock the provider
    mock_provider = MagicMock(spec=MarketDataProvider)
    mock_provider.fetch_ohlcv.return_value = ohlcv
    mock_provider.get_provider_name.return_value = "mock"
    monkeypatch.setattr(backtest_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(backtest_storage, "BACKTEST_DIR", tmp_path / "backtests")

    client = TestClient(app)
    payload = _base_payload()
    payload["min_history"] = 10  # force no trades

    run_res = client.post("/api/backtest/run", json=payload)
    assert run_res.status_code == 200
    run_data = run_res.json()
    summary = run_data["summary"]
    assert summary["trades"] == 0
    assert summary["expectancy_R"] is None
    assert summary["winrate"] is None
    assert summary["profit_factor_R"] is None
    assert summary["avg_R"] is None
    assert summary["avg_win_R"] is None
    assert summary["avg_loss_R"] is None
    assert summary["trade_frequency_per_year"] is None
    assert summary["rr_distribution"] is None
