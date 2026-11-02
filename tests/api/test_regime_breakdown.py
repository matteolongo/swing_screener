"""Tests for regime analytics service and endpoint."""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.services.regime_analytics import (
    REGIME_CHOPPY,
    REGIME_TRENDING_DOWN,
    REGIME_TRENDING_UP,
    RegimeAnalyticsService,
    label_regime_at_date,
)
from swing_screener.portfolio.analytics import calculate_portfolio_analytics

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


def _closed_trade(**changes):
    return {
        "position_id": "P1",
        "ticker": "AAPL",
        "status": "closed",
        "entry_date": "2026-10-01",
        "exit_date": "2026-10-14",
        "entry_price": 100,
        "exit_price": 108,
        "initial_risk": 5,
        "stop_price": 103,
        "shares": 5,
        "partial_closes": [
            {"date": "2026-10-13", "shares_closed": 5, "price": 110, "r_at_close": 2}
        ],
        **changes,
    }


def _grouped_stats(positions, monkeypatch):
    prices = pd.DataFrame(
        {"Close": range(100, 500)}, index=pd.bdate_range(end="2026-10-14", periods=400)
    )
    monkeypatch.setattr("yfinance.download", lambda *args, **kwargs: prices)
    repository = SimpleNamespace(list_positions=lambda: (positions, "2026-10-14"))
    result = RegimeAnalyticsService(repository).get_regime_breakdown()
    return result["regimes"][0]


def test_regime_reuses_shares_weighted_canonical_r(monkeypatch):
    positions = [_closed_trade(fees_eur=25, exit_fx_rate=1.2)]
    canonical = calculate_portfolio_analytics(positions)
    assert canonical.average_r == pytest.approx(1.8)
    grouped = _grouped_stats(positions, monkeypatch)
    assert grouped["avg_r"] == pytest.approx(canonical.average_r)
    assert grouped["expectancy"] == pytest.approx(canonical.average_r)


def test_regime_excludes_scratches_from_win_rate_and_unknown_risk_from_aggregates(
    monkeypatch,
):
    positions = [
        _closed_trade(),
        _closed_trade(position_id="scratch", exit_price=100, partial_closes=[]),
        _closed_trade(position_id="loss", exit_price=95, partial_closes=[]),
        _closed_trade(position_id="unknown", initial_risk=None),
    ]
    canonical = calculate_portfolio_analytics(positions)
    grouped = _grouped_stats(positions, monkeypatch)
    assert grouped["count"] == canonical.closed_trade_count == 3
    assert grouped["win_rate"] == pytest.approx(canonical.win_rate)
    assert grouped["avg_r"] == pytest.approx(canonical.average_r, abs=0.0001)


def test_scratch_only_regime_has_unavailable_win_rate(monkeypatch):
    grouped = _grouped_stats(
        [_closed_trade(exit_price=100, partial_closes=[])], monkeypatch
    )
    assert grouped["count"] == 1
    assert grouped["avg_r"] == 0
    assert grouped["win_rate"] is None


def test_excluded_unknown_risk_trade_cannot_break_regime_dates(monkeypatch):
    grouped = _grouped_stats(
        [
            _closed_trade(),
            _closed_trade(
                position_id="legacy", initial_risk=None, entry_date="not-a-date"
            ),
        ],
        monkeypatch,
    )
    assert grouped["count"] == 1
    assert grouped["avg_r"] == pytest.approx(1.8)


@pytest.mark.parametrize("scratch", [False, True])
def test_endpoint_preserves_canonical_r_and_nullable_win_rate(
    tmp_path, monkeypatch, scratch
):
    position = _closed_trade()
    if scratch:
        position.update(exit_price=100, partial_closes=[])
    pos_file = _write_positions(tmp_path, [position])
    import api.dependencies as deps

    monkeypatch.setattr(deps, "_positions_path", pos_file)
    prices = pd.DataFrame(
        {"Close": range(100, 500)}, index=pd.bdate_range(end="2026-10-14", periods=400)
    )
    with patch("yfinance.download", return_value=prices):
        response = client.get("/api/portfolio/analytics/regime-breakdown")
    assert response.status_code == 200
    stats = response.json()["regimes"][0]
    canonical = calculate_portfolio_analytics([position])
    assert stats["avg_r"] == pytest.approx(canonical.average_r)
    assert stats["win_rate"] == canonical.win_rate


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
            "position_id": "a",
            "ticker": "AAPL",
            "status": "closed",
            "entry_date": "2024-06-15",
            "exit_date": "2024-07-01",
            "entry_price": 100.0,
            "exit_price": 120.0,
            "shares": 10,
            "initial_risk": 10.0,
            "stop_price": 90.0,
        },
        {
            "position_id": "b",
            "ticker": "MSFT",
            "status": "closed",
            "entry_date": "2024-06-15",
            "exit_date": "2024-07-10",
            "entry_price": 200.0,
            "exit_price": 180.0,
            "shares": 5,
            "initial_risk": 10.0,
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
    # pos a: r = (120-100)/10 = +2.0; pos b: r = (180-200)/10 = -2.0
    assert tu["win_rate"] == 50.0
    assert abs(tu["avg_r"]) < 0.01


@pytest.mark.parametrize(
    "unavailable",
    [
        None,
        pd.DataFrame(),
        RuntimeError("secret provider details"),
        pd.DataFrame({"Volume": [100]}, index=pd.to_datetime(["2024-06-14"])),
        pd.DataFrame({"Close": [float("nan")]}, index=pd.to_datetime(["2024-06-14"])),
    ],
)
def test_endpoint_benchmark_unavailable_is_not_empty_success(
    tmp_path, monkeypatch, unavailable
):
    positions = [
        {
            "position_id": "c",
            "ticker": "AAPL",
            "status": "closed",
            "entry_date": "2024-06-15",
            "exit_date": "2024-07-01",
            "entry_price": 100.0,
            "exit_price": 120.0,
            "shares": 10,
            "initial_risk": 10.0,
            "stop_price": 90.0,
        },
    ]
    pos_file = _write_positions(tmp_path, positions)
    import api.dependencies as deps

    monkeypatch.setattr(deps, "_positions_path", pos_file)

    with patch(
        "yfinance.download",
        **(
            {"side_effect": unavailable}
            if isinstance(unavailable, Exception)
            else {"return_value": unavailable}
        ),
    ):
        response = client.get("/api/portfolio/analytics/regime-breakdown")

    assert response.status_code == 503
    assert "secret provider details" not in response.text
