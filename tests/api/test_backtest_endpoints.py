from __future__ import annotations

from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.dependencies import get_backtest_service
from api.main import app
from api.models.backtest import EventStudyRequest
from api.services.backtest_service import BacktestService


def _strategy(**manage_overrides) -> dict:
    return {
        "signals": {"breakout_lookback": 5, "pullback_ma": 5, "min_history": 15},
        "risk": {"k_atr": 2.0, "rr_target": 2.0},
        "manage": {
            "breakeven_at_r": 1.0,
            "trail_after_r": 2.0,
            "trail_sma": 5,
            "max_holding_days": 20,
            **manage_overrides,
        },
    }


def _fake_strategy_repo(strategy: dict | None = None):
    return SimpleNamespace(get_active_strategy=lambda: strategy or _strategy())


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
        provider=_FakeProvider(ohlcv), strategy_repo=_fake_strategy_repo()
    )


def _climb_ohlcv() -> pd.DataFrame:
    # 20 flat bars, a breakout, then a short climb that ends on the time-exit bar
    # so the single trade leaves no room for a second signal.
    closes = [100.0] * 20 + [110.0, 112.0, 114.0, 116.0, 118.0]
    opens = list(closes)
    highs = [c + 1.0 for c in closes]
    lows = [c - 1.0 for c in closes]
    return _ohlcv("TEST", opens, highs, lows, closes)


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


def test_event_study_uses_active_strategy_config():
    # The active strategy caps holding at 3 bars; a no-override run must honour it
    # (proving the baseline comes from the strategy, not the bare defaults).
    service = BacktestService(
        provider=_FakeProvider(_climb_ohlcv()),
        strategy_repo=_fake_strategy_repo(
            _strategy(max_holding_days=3, exit_signal_days=0)
        ),
    )

    result = service.run_event_study(EventStudyRequest(tickers=["TEST"]))

    assert len(result.trades) == 1
    assert result.trades[0].exit_reason == "time_exit"
    assert result.trades[0].bars_held == 3


def test_event_study_rejects_empty_tickers():
    _override(_collapse_ohlcv())
    client = TestClient(app)

    resp = client.post("/api/backtest/event-study", json={"tickers": []})

    assert resp.status_code == 400
