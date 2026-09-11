from __future__ import annotations

from unittest.mock import MagicMock

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.dependencies import get_portfolio_service
from api.main import app
import api.services.screener_service as screener_service
from swing_screener.data.providers import MarketDataProvider
from swing_screener.data.source_health import DataSourceHealth
from api.services.screener_fx import resolve_fx_conversion


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
    assert eur["position_size_quote"] == eur["recommendation"]["risk"]["position_size"]
    assert eur["risk_quote"] == eur["recommendation"]["risk"]["risk_amount"]
    assert eur["recommendation"]["risk"]["currency"] == "EUR"
    assert eur["recommendation"]["risk"]["account_currency"] == "EUR"

    usd = candidates["AAPL"]
    assert usd["quote_currency"] == "USD"
    assert usd["account_currency"] == "EUR"
    assert usd["position_size_quote"] == usd["recommendation"]["risk"]["position_size"]
    assert usd["risk_quote"] == usd["recommendation"]["risk"]["risk_amount"]
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
    assert candidate["risk_pct"] == 0.0
    risk = candidate["recommendation"]["risk"]
    assert risk["account_to_quote_rate"] is None
    assert risk["risk_amount_account"] == 0.0
    reason_codes = {
        reason["code"] for reason in candidate["recommendation"]["reasons_detailed"]
    }
    assert "FX_RATE_MISSING" in reason_codes


def _configured_repo(account_currency: str):
    from api.models.config import AppConfig
    from api.repositories.config_repo import ConfigRepository

    base = ConfigRepository.get_defaults().model_copy(deep=True)
    base.risk.account_currency = account_currency
    return ConfigRepository(initial_config=AppConfig.model_validate(base.model_dump()))


def _screener_service_with_config(tmp_path, config_repo, fx_pairs: dict):
    from unittest.mock import MagicMock

    from api.repositories.strategy_repo import StrategyRepository
    from api.services.portfolio_service import PortfolioService
    from api.services.screener_service import ScreenerService
    from swing_screener.selection.eval_cache import EvalCache

    idx = pd.date_range("2024-01-01", periods=2, freq="B")
    data: dict[tuple[str, str], list[float]] = {}
    for pair, rate in fx_pairs.items():
        data[("Open", pair)] = [rate, rate]
        data[("High", pair)] = [rate, rate]
        data[("Low", pair)] = [rate, rate]
        data[("Close", pair)] = [rate, rate]
        data[("Volume", pair)] = [1_000_000, 1_000_000]
    fx_frame = pd.DataFrame(data, index=idx)
    if not fx_frame.empty:
        fx_frame.columns = pd.MultiIndex.from_tuples(fx_frame.columns)

    provider = MagicMock(spec=MarketDataProvider)
    provider.fetch_ohlcv.return_value = fx_frame
    provider.get_provider_name.return_value = "mock"
    provider.get_source_health.return_value = DataSourceHealth(
        provider="mock",
        domain="market_data",
        status="ok",
        quality_score=0.7,
        delay_policy="test_fixture",
    )

    svc = ScreenerService(
        strategy_repo=MagicMock(spec=StrategyRepository),
        portfolio_service=MagicMock(spec=PortfolioService),
        provider=provider,
        eval_cache=EvalCache(root=tmp_path / "eval_cache"),
        config_repo=config_repo,
    )
    return svc


def _build_ctx(svc, strategy: dict, account_currency: str):
    from api.models.screener import ScreenerRequest
    from api.services.screener_service import _RunContext
    from swing_screener.recommendation.priority import CombinedPriorityConfig
    from swing_screener.strategy.config import (
        build_entry_config,
        build_universe_config,
    )

    ctx = _RunContext(
        request=ScreenerRequest(tickers=["AAA"], top=1, asof_date="2024-01-05"),
        strategy={
            k: (dict(v) if isinstance(v, dict) else v) for k, v in strategy.items()
        },
        account_currency=account_currency,
        combined_priority_cfg=CombinedPriorityConfig(),
    )
    ctx.universe_cfg = build_universe_config(ctx.strategy)
    ctx.signals_cfg = build_entry_config(ctx.strategy)
    ctx.ohlcv = None
    ctx.benchmark = "SPY"
    ctx.asof_str = "2024-01-05"
    ctx.start_date = "2024-01-01"
    ctx.end_date = "2024-01-05"
    ctx.active_currencies = []
    svc._build_run_configs(ctx, requested_top=1)
    return ctx


def _strategy_with_legacy_currency(legacy: str) -> dict:
    return {
        "risk": {
            "account_size": 10000.0,
            "account_currency": legacy,
            "risk_pct": 0.01,
            "k_atr": 2.0,
            "max_position_pct": 0.5,
            "min_shares": 1,
            "min_rr": 2.0,
            "rr_target": 2.0,
            "commission_pct": 0.0,
            "max_fee_risk_pct": 0.2,
        }
    }


def test_build_run_configs_enforces_configured_usd_over_legacy_eur(tmp_path):
    from swing_screener.risk.position_sizing import position_plan

    config_repo = _configured_repo("USD")
    svc = _screener_service_with_config(tmp_path, config_repo, {"USDEUR=X": 0.80})
    strategy = _strategy_with_legacy_currency("EUR")
    ctx = _build_ctx(svc, strategy, config_repo.get().risk.account_currency)

    assert ctx.account_currency == "USD"
    assert ctx.risk_cfg is not None
    assert ctx.risk_cfg.account_currency == "USD"
    assert ctx.report_cfg is not None
    assert ctx.report_cfg.risk.account_currency == "USD"
    # Only account currency is authoritative; other risk settings stay owned
    # by the strategy payload.
    assert ctx.risk_cfg.account_size == pytest.approx(10000.0)
    assert ctx.risk_cfg.risk_pct == pytest.approx(0.01)
    assert ctx.risk_cfg.k_atr == pytest.approx(2.0)
    assert ctx.risk_cfg.max_position_pct == pytest.approx(0.5)
    # Strategy payload itself must not be mutated.
    assert strategy["risk"]["account_currency"] == "EUR"

    account_to_quote, _quote_to_eur = svc._screener_fx_rate_maps(
        ctx, {"AAA": {"currency": "EUR"}}
    )
    assert account_to_quote["EUR"] == pytest.approx(0.80)
    assert account_to_quote["EUR"] != pytest.approx(1.0)

    plan = position_plan(
        100.0,
        5.0,
        ctx.risk_cfg,
        quote_currency="EUR",
        account_to_quote_rate=account_to_quote["EUR"],
    )
    assert plan is not None
    assert plan["account_currency"] == "USD"
    assert plan["quote_currency"] == "EUR"
    assert plan["account_to_quote_rate"] == pytest.approx(0.80)
    # 1% of 10,000 USD = 100 USD -> 80 EUR at 0.80.
    assert plan["risk_amount_target_account"] == pytest.approx(100.0)
    assert plan["risk_amount_target_quote"] == pytest.approx(80.0)
    assert plan["risk_amount_target_quote"] == pytest.approx(
        plan["risk_amount_target_account"] * 0.80
    )


def test_legacy_strategy_currency_does_not_change_usd_sizing(tmp_path):
    from swing_screener.risk.position_sizing import position_plan

    config_repo = _configured_repo("USD")

    svc_eur = _screener_service_with_config(tmp_path, config_repo, {"USDEUR=X": 0.80})
    ctx_eur = _build_ctx(
        svc_eur,
        _strategy_with_legacy_currency("EUR"),
        config_repo.get().risk.account_currency,
    )
    rates_eur, _ = svc_eur._screener_fx_rate_maps(ctx_eur, {"AAA": {"currency": "EUR"}})
    plan_eur = position_plan(
        100.0,
        5.0,
        ctx_eur.risk_cfg,
        quote_currency="EUR",
        account_to_quote_rate=rates_eur["EUR"],
    )

    svc_usd = _screener_service_with_config(tmp_path, config_repo, {"USDEUR=X": 0.80})
    ctx_usd = _build_ctx(
        svc_usd,
        _strategy_with_legacy_currency("USD"),
        config_repo.get().risk.account_currency,
    )
    rates_usd, _ = svc_usd._screener_fx_rate_maps(ctx_usd, {"AAA": {"currency": "EUR"}})
    plan_usd = position_plan(
        100.0,
        5.0,
        ctx_usd.risk_cfg,
        quote_currency="EUR",
        account_to_quote_rate=rates_usd["EUR"],
    )

    assert ctx_eur.risk_cfg.account_currency == "USD"
    assert ctx_usd.risk_cfg.account_currency == "USD"
    assert rates_eur == rates_usd
    assert plan_eur is not None and plan_usd is not None
    assert plan_eur == plan_usd


def test_build_run_configs_enforces_configured_eur_over_legacy_usd(tmp_path):
    from swing_screener.risk.position_sizing import position_plan

    config_repo = _configured_repo("EUR")
    svc = _screener_service_with_config(tmp_path, config_repo, {"EURUSD=X": 1.25})
    strategy = _strategy_with_legacy_currency("USD")
    ctx = _build_ctx(svc, strategy, config_repo.get().risk.account_currency)

    assert ctx.risk_cfg is not None
    assert ctx.risk_cfg.account_currency == "EUR"
    assert ctx.report_cfg is not None
    assert ctx.report_cfg.risk.account_currency == "EUR"
    assert strategy["risk"]["account_currency"] == "USD"

    account_to_quote, _quote_to_eur = svc._screener_fx_rate_maps(
        ctx, {"AAPL": {"currency": "USD"}}
    )
    assert account_to_quote["USD"] == pytest.approx(1.25)
    assert account_to_quote["USD"] != pytest.approx(1.0)

    plan = position_plan(
        181.0,
        4.0,
        ctx.risk_cfg,
        quote_currency="USD",
        account_to_quote_rate=account_to_quote["USD"],
    )
    assert plan is not None
    assert plan["account_currency"] == "EUR"
    assert plan["quote_currency"] == "USD"
    assert plan["account_to_quote_rate"] == pytest.approx(1.25)
    assert plan["risk_amount_target_quote"] == pytest.approx(
        plan["risk_amount_target_account"] * 1.25
    )
