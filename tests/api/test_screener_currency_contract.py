from __future__ import annotations

from unittest.mock import MagicMock

import pandas as pd
from fastapi.testclient import TestClient

from api.dependencies import get_portfolio_service
from api.main import app
import api.services.screener_service as screener_service
from swing_screener.data.providers import MarketDataProvider
from swing_screener.data.source_health import DataSourceHealth


def _ohlcv() -> pd.DataFrame:
    idx = pd.date_range("2026-04-15", periods=2, freq="D")
    prices = {
        "ABN.AS": [35.10, 35.42],
        "AAPL": [180.0, 181.0],
        "SPY": [500.0, 502.0],
        "ACWI": [100.0, 101.0],
    }
    data: dict[tuple[str, str], list[float]] = {}
    for ticker, closes in prices.items():
        data[("Open", ticker)] = closes
        data[("High", ticker)] = [value + 1.0 for value in closes]
        data[("Low", ticker)] = [value - 1.0 for value in closes]
        data[("Close", ticker)] = closes
        data[("Volume", ticker)] = [1_000_000, 1_000_000]
    frame = pd.DataFrame(data, index=idx)
    frame.columns = pd.MultiIndex.from_tuples(frame.columns)
    return frame


def _mock_provider() -> MarketDataProvider:
    provider = MagicMock(spec=MarketDataProvider)
    provider.fetch_ohlcv.return_value = _ohlcv()
    provider.get_provider_name.return_value = "mock"
    provider.get_source_health.return_value = DataSourceHealth(
        provider="mock",
        domain="market_data",
        status="ok",
        quality_score=0.7,
        delay_policy="test_fixture",
    )
    return provider


class _PortfolioStub:
    def list_positions(self, status=None, **kwargs):
        return type("Positions", (), {"positions": []})()


def test_screener_candidate_exposes_quote_and_account_currency_money_fields(monkeypatch):
    def fake_build_daily_report(*args, **kwargs):
        return pd.DataFrame(
            {
                "atr14": [1.0, 2.0],
                "mom_6m": [0.1, 0.2],
                "mom_12m": [0.2, 0.3],
                "rs_6m": [0.05, 0.06],
                "score": [0.8, 0.7],
                "confidence": [70.0, 65.0],
                "last": [35.42, 181.0],
                "currency": ["EUR", "USD"],
                "ma20_level": [35.10, 180.0],
                "dist_sma50_pct": [4.0, 5.0],
                "dist_sma200_pct": [8.0, 10.0],
                "rank": [1, 2],
                "signal": ["breakout", "breakout"],
                "entry": [35.42, 181.0],
                "stop": [34.0, 177.0],
                "shares": [100, 3],
                "position_value": [3542.0, 543.0],
                "realized_risk": [142.0, 12.0],
            },
            index=["ABN.AS", "AAPL"],
        )

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: _mock_provider())
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(
        screener_service,
        "get_multiple_ticker_info",
        lambda tickers: {
            "ABN.AS": {"name": "ABN AMRO", "currency": "EUR"},
            "AAPL": {"name": "Apple Inc.", "currency": "USD"},
        },
    )
    monkeypatch.setattr(
        screener_service,
        "fetch_next_earnings_days",
        lambda tickers, finnhub_api_key, asof_date, **kwargs: {ticker: None for ticker in tickers},
    )

    app.dependency_overrides[get_portfolio_service] = lambda: _PortfolioStub()
    try:
        response = TestClient(app).post(
            "/api/screener/run",
            json={"tickers": ["ABN.AS", "AAPL"], "top": 2},
        )
    finally:
        app.dependency_overrides.pop(get_portfolio_service, None)

    assert response.status_code == 200
    candidates = {candidate["ticker"]: candidate for candidate in response.json()["candidates"]}

    eur = candidates["ABN.AS"]
    assert eur["quote_currency"] == "EUR"
    assert eur["account_currency"] == "EUR"
    assert eur["position_size_quote"] == 3542.0
    assert eur["risk_quote"] == 142.0
    assert eur["recommendation"]["risk"]["currency"] == "EUR"
    assert eur["recommendation"]["risk"]["account_currency"] == "EUR"

    usd = candidates["AAPL"]
    assert usd["quote_currency"] == "USD"
    assert usd["account_currency"] == "EUR"
    assert usd["position_size_quote"] == 543.0
    assert usd["risk_quote"] == 12.0
    assert usd["recommendation"]["risk"]["currency"] == "USD"
    assert usd["recommendation"]["risk"]["account_currency"] == "EUR"
