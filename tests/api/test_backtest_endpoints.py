from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.dependencies import get_backtest_service
from api.main import app
from api.services.backtest_service import BacktestService


def _ohlcv(ticker: str, opens, highs, lows, closes) -> pd.DataFrame:
    n = len(closes)
    idx = pd.date_range("2022-01-03", periods=n, freq="B")
    cols = pd.MultiIndex.from_tuples(
        [
            ("Open", ticker),
            ("High", ticker),
            ("Low", ticker),
            ("Close", ticker),
            ("Volume", ticker),
        ]
    )
    data = np.column_stack([opens, highs, lows, closes, [1_000_000] * n])
    return pd.DataFrame(data, index=idx, columns=cols)


def _collapse_ohlcv() -> pd.DataFrame:
    closes = [100.0] * 20 + [110.0, 90.0]
    opens = [100.0] * 20 + [110.0, 110.0]
    highs = [101.0] * 20 + [111.0, 111.0]
    lows = [99.0] * 20 + [99.0, 89.0]
    return _ohlcv("TEST", opens, highs, lows, closes)


class _FakeProvider:
    def __init__(self, ohlcv: pd.DataFrame) -> None:
        self._ohlcv = ohlcv

    def fetch_ohlcv(self, tickers, start_date, end_date, interval: str = "1d"):
        return self._ohlcv


def _override(ohlcv: pd.DataFrame):
    app.dependency_overrides[get_backtest_service] = lambda: BacktestService(
        provider=_FakeProvider(ohlcv)
    )


def teardown_function() -> None:
    app.dependency_overrides.pop(get_backtest_service, None)


def test_event_study_endpoint_returns_trades_and_metrics():
    _override(_collapse_ohlcv())
    client = TestClient(app)

    resp = client.post(
        "/api/backtest/event-study",
        json={
            "tickers": ["TEST"],
            "config": {
                "pattern_stop_enabled": False,
                "breakout_lookback": 5,
                "pullback_ma": 5,
                "min_history": 15,
                "exit_signal_days": 0,
                "trail_sma": 5,
            },
        },
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["tickers"] == ["TEST"]
    assert len(body["trades"]) == 1
    trade = body["trades"][0]
    assert trade["exit_reason"] == "stop_hit"
    assert trade["r_multiple"] == pytest.approx(-1.0)
    assert body["metrics"]["n_trades"] == 1
    assert body["metrics"]["win_rate"] == pytest.approx(0.0)


def test_event_study_rejects_empty_tickers():
    _override(_collapse_ohlcv())
    client = TestClient(app)

    resp = client.post("/api/backtest/event-study", json={"tickers": []})

    assert resp.status_code == 400
