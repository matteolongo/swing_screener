"""Tests for regime analytics service and endpoint."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.services.regime_analytics import (
    REGIME_CHOPPY,
    REGIME_TRENDING_DOWN,
    REGIME_TRENDING_UP,
    label_regime_at_date,
)

client = TestClient(app)


# ─── helpers ────────────────────────────────────────────────────────────────


def _make_close(n: int, prices: list[float] | None = None) -> pd.Series:
    """Build a close series with DatetimeIndex."""
    dates = pd.date_range("2023-01-01", periods=n, freq="B")
    vals = prices if prices is not None else [100.0] * n
    return pd.Series(vals, index=dates)


def _write_positions(tmp_path: Path, positions: list) -> Path:
    pos_file = tmp_path / "positions.json"
    pos_file.write_text(json.dumps({"asof": "2024-01-01", "positions": positions}))
    return pos_file


def _make_spy_df(n: int, prices: list[float]) -> pd.DataFrame:
    idx = pd.date_range("2023-06-01", periods=n, freq="B")
    return pd.DataFrame({"Close": pd.Series(prices, index=idx)})


# ─── label_regime_at_date unit tests ────────────────────────────────────────


def test_label_trending_up():
    # 250 days of rising prices — close > SMA50 > SMA200
    prices = [100.0 + i * 0.5 for i in range(250)]
    close = _make_close(250, prices)
    target = close.index[-1].date().isoformat()
    assert label_regime_at_date(close, target) == REGIME_TRENDING_UP


def test_label_trending_down():
    # 250 days of declining prices — close < SMA50 < SMA200
    prices = [200.0 - i * 0.5 for i in range(250)]
    close = _make_close(250, prices)
    target = close.index[-1].date().isoformat()
    assert label_regime_at_date(close, target) == REGIME_TRENDING_DOWN


def test_label_empty_series_returns_choppy():
    close = pd.Series([], dtype=float)
    assert label_regime_at_date(close, "2024-01-15") == REGIME_CHOPPY


def test_label_insufficient_history_fallback_to_fast_sma():
    # Only 60 bars — enough for SMA50, not SMA200 — rising prices → trending_up
    prices = [100.0 + i * 0.5 for i in range(60)]
    close = _make_close(60, prices)
    target = close.index[-1].date().isoformat()
    assert label_regime_at_date(close, target) == REGIME_TRENDING_UP


def test_label_insufficient_history_fallback_declining():
    # 60 bars, declining prices → trending_down via fast SMA fallback
    prices = [200.0 - i * 0.5 for i in range(60)]
    close = _make_close(60, prices)
    target = close.index[-1].date().isoformat()
    assert label_regime_at_date(close, target) == REGIME_TRENDING_DOWN


def test_label_target_beyond_series_uses_last_available():
    # Target after last bar — slice is empty after target, so uses all data
    prices = [100.0 + i * 0.5 for i in range(250)]
    close = _make_close(250, prices)
    target = (close.index[-1] + pd.Timedelta(days=30)).date().isoformat()
    assert label_regime_at_date(close, target) == REGIME_TRENDING_UP


def test_label_too_few_for_fast_sma_returns_choppy():
    # Only 10 bars — not enough for SMA50
    prices = [100.0 + i for i in range(10)]
    close = _make_close(10, prices)
    target = close.index[-1].date().isoformat()
    assert label_regime_at_date(close, target) == REGIME_CHOPPY


# ─── endpoint tests ──────────────────────────────────────────────────────────


def test_endpoint_returns_empty_when_no_closed_positions(tmp_path, monkeypatch):
    pos_file = _write_positions(tmp_path, [])
    import api.dependencies as deps
    monkeypatch.setattr(deps, "_positions_path", pos_file)

    response = client.get("/api/portfolio/analytics/regime-breakdown")
    assert response.status_code == 200
    data = response.json()
    assert data["regimes"] == []
    assert data["benchmark"] == "SPY"


def test_endpoint_returns_regime_stats(tmp_path, monkeypatch):
    positions = [
        {
            "id": "a", "ticker": "AAPL", "status": "closed",
            "entry_date": "2024-06-15", "exit_date": "2024-07-01",
            "entry_price": 100.0, "exit_price": 120.0,
            "shares": 10, "initial_risk": 100.0,
            "stop_price": 90.0,
        },
        {
            "id": "b", "ticker": "MSFT", "status": "closed",
            "entry_date": "2024-06-15", "exit_date": "2024-07-10",
            "entry_price": 200.0, "exit_price": 180.0,
            "shares": 5, "initial_risk": 50.0,
            "stop_price": 190.0,
        },
    ]
    pos_file = _write_positions(tmp_path, positions)
    import api.dependencies as deps
    monkeypatch.setattr(deps, "_positions_path", pos_file)

    # 400 days of rising prices → trending_up at both entry dates
    rising_prices = [400.0 + i * 0.5 for i in range(400)]
    spy_df = _make_spy_df(400, rising_prices)

    with patch("yfinance.download", return_value=spy_df):
        response = client.get("/api/portfolio/analytics/regime-breakdown")

    assert response.status_code == 200
    data = response.json()
    assert data["benchmark"] == "SPY"
    regimes = {r["regime"]: r for r in data["regimes"]}
    assert "trending_up" in regimes
    tu = regimes["trending_up"]
    assert tu["count"] == 2
    # pos a: r = (120-100)*10/100 = +2.0; pos b: r = (180-200)*5/50 = -2.0
    assert tu["win_rate"] == 50.0
    assert abs(tu["avg_r"]) < 0.01


def test_endpoint_yfinance_failure_returns_empty(tmp_path, monkeypatch):
    positions = [
        {
            "id": "c", "ticker": "AAPL", "status": "closed",
            "entry_date": "2024-06-15", "exit_date": "2024-07-01",
            "entry_price": 100.0, "exit_price": 120.0,
            "shares": 10, "initial_risk": 100.0,
            "stop_price": 90.0,
        },
    ]
    pos_file = _write_positions(tmp_path, positions)
    import api.dependencies as deps
    monkeypatch.setattr(deps, "_positions_path", pos_file)

    with patch("yfinance.download", side_effect=Exception("network error")):
        response = client.get("/api/portfolio/analytics/regime-breakdown")

    assert response.status_code == 200
    data = response.json()
    assert data["regimes"] == []
