from __future__ import annotations

from unittest.mock import MagicMock

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.dependencies import get_portfolio_service
from api.main import app
from api.services import screener_service
from api.services.screener_fx import resolve_fx_conversion
from swing_screener.data.providers import MarketDataProvider
from swing_screener.data.source_health import DataSourceHealth


def test_fx_resolver_handles_identity_direct_and_inverse_rates():
    assert resolve_fx_conversion("EUR", "EUR", {}).rate == 1.0
    direct = resolve_fx_conversion("EUR", "USD", {"EURUSD=X": 1.25})
    assert direct.status == "available"
    assert direct.rate == 1.25
    inverse = resolve_fx_conversion("USD", "EUR", {"EURUSD=X": 1.25})
    assert inverse.status == "available"
    assert inverse.rate == pytest.approx(0.8)


def test_fx_resolver_returns_typed_unavailable_for_missing_or_invalid_rate():
    missing = resolve_fx_conversion("EUR", "GBP", {})
    assert missing.status == "unavailable"
    assert missing.reason == "fx_rate_unavailable"
    invalid = resolve_fx_conversion("EUR", "USD", {"EURUSD=X": float("nan")})
    assert invalid.status == "unavailable"


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


def test_screener_candidate_exposes_quote_and_account_currency_money_fields(
    monkeypatch,
):
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
                "position_value_account": [3542.0, 434.4],
                "realized_risk": [142.0, 12.0],
                "realized_risk_account": [142.0, 9.6],
                "account_to_quote_rate": [1.0, 1.25],
            },
            index=["ABN.AS", "AAPL"],
        )

    monkeypatch.setattr(
        screener_service, "get_market_data_provider", lambda **kwargs: _mock_provider()
    )
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
        lambda tickers, finnhub_api_key, asof_date, **kwargs: {
            ticker: None for ticker in tickers
        },
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
    candidates = {
        candidate["ticker"]: candidate for candidate in response.json()["candidates"]
    }

    eur = candidates["ABN.AS"]
    assert eur["quote_currency"] == "EUR"
    assert eur["account_currency"] == "EUR"
    assert eur["entry_quote"] == 35.42
    assert eur["stop_quote"] == 34.0
    assert eur["target_quote"] == eur["recommendation"]["risk"]["target"]
    assert eur["risk_per_share_quote"] == pytest.approx(1.42)
    assert eur["position_size_quote"] == eur["recommendation"]["risk"]["position_size"]
    assert eur["risk_quote"] == eur["recommendation"]["risk"]["risk_amount"]
    assert (
        eur["position_size_account"]
        == eur["recommendation"]["risk"]["position_size_account"]
    )
    assert eur["risk_account"] == eur["recommendation"]["risk"]["risk_amount_account"]
    assert eur["position_size_usd"] is None
    assert eur["risk_usd"] is None
    assert eur["recommendation"]["risk"]["currency"] == "EUR"
    assert eur["recommendation"]["risk"]["account_currency"] == "EUR"

    usd = candidates["AAPL"]
    assert usd["quote_currency"] == "USD"
    assert usd["account_currency"] == "EUR"
    assert usd["entry_quote"] == 181.0
    assert usd["stop_quote"] == 177.0
    assert usd["target_quote"] == usd["recommendation"]["risk"]["target"]
    assert usd["risk_per_share_quote"] == 4.0
    assert usd["position_size_quote"] == usd["recommendation"]["risk"]["position_size"]
    assert usd["risk_quote"] == usd["recommendation"]["risk"]["risk_amount"]
    assert (
        usd["position_size_account"]
        == usd["recommendation"]["risk"]["position_size_account"]
    )
    assert usd["position_size_account"] == pytest.approx(
        usd["position_size_quote"] / 1.25
    )
    assert usd["risk_account"] == usd["recommendation"]["risk"]["risk_amount_account"]
    assert usd["risk_account"] == pytest.approx(usd["risk_quote"] / 1.25)
    assert usd["position_size_usd"] == usd["position_size_quote"]
    assert usd["risk_usd"] == usd["risk_quote"]
    assert usd["risk_pct"] == usd["recommendation"]["risk"]["risk_pct"]
    assert usd["recommendation"]["risk"]["currency"] == "USD"
    assert usd["recommendation"]["risk"]["account_currency"] == "EUR"
    assert usd["recommendation"]["risk"]["account_to_quote_rate"] == 1.25
    assert usd["recommendation"]["risk"]["risk_amount_account"] == pytest.approx(
        usd["risk_quote"] / 1.25, abs=1e-6
    )


def test_screener_candidate_does_not_derive_risk_pct_from_quote_risk_without_fx(
    monkeypatch,
):
    def fake_build_daily_report(*args, **kwargs):
        return pd.DataFrame(
            {
                "atr14": [2.0],
                "mom_6m": [0.2],
                "mom_12m": [0.3],
                "rs_6m": [0.06],
                "score": [0.7],
                "confidence": [65.0],
                "last": [181.0],
                "currency": ["USD"],
                "ma20_level": [180.0],
                "dist_sma50_pct": [5.0],
                "dist_sma200_pct": [10.0],
                "rank": [1],
                "signal": ["breakout"],
                "entry": [181.0],
                "stop": [177.0],
                "shares": [3],
                "position_value": [543.0],
                "realized_risk": [12.0],
            },
            index=["AAPL"],
        )

    monkeypatch.setattr(
        screener_service, "get_market_data_provider", lambda **kwargs: _mock_provider()
    )
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(
        screener_service,
        "get_multiple_ticker_info",
        lambda tickers: {"AAPL": {"name": "Apple Inc.", "currency": "USD"}},
    )
    monkeypatch.setattr(
        screener_service,
        "fetch_next_earnings_days",
        lambda tickers, finnhub_api_key, asof_date, **kwargs: {
            ticker: None for ticker in tickers
        },
    )

    app.dependency_overrides[get_portfolio_service] = lambda: _PortfolioStub()
    try:
        response = TestClient(app).post(
            "/api/screener/run",
            json={"tickers": ["AAPL"], "top": 1},
        )
    finally:
        app.dependency_overrides.pop(get_portfolio_service, None)

    assert response.status_code == 200
    candidate = response.json()["candidates"][0]
    assert candidate["quote_currency"] == "USD"
    assert candidate["account_currency"] == "EUR"
    assert candidate["risk_quote"] == 0.0
    assert candidate["position_size_account"] is None
    assert candidate["risk_account"] is None
    assert candidate["risk_pct"] == 0.0
    risk = candidate["recommendation"]["risk"]
    assert risk["account_to_quote_rate"] is None
    assert risk["risk_amount_account"] == 0.0
    reason_codes = {
        reason["code"] for reason in candidate["recommendation"]["reasons_detailed"]
    }
    assert "FX_RATE_MISSING" in reason_codes


def test_legacy_usd_candidate_fields_are_marked_deprecated_in_openapi():
    candidate_schema = app.openapi()["components"]["schemas"]["ScreenerCandidate"]

    assert candidate_schema["properties"]["position_size_usd"]["deprecated"] is True
    assert candidate_schema["properties"]["risk_usd"]["deprecated"] is True
