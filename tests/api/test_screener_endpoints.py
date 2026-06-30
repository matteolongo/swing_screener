import pandas as pd
import datetime as dt
import time
import pytest
from fastapi.testclient import TestClient
from swing_screener.selection.screening_window import (
    resolve_fetch_start_date,
    resolve_default_asof_date,
    resolve_data_freshness,
)
from unittest.mock import MagicMock
from types import SimpleNamespace

from api.main import app
from api.dependencies import get_orders_service, get_portfolio_service
import api.services.screener_service as screener_service
import api.services.decision_context as decision_context
from api.models.screener import ScreenerResponse
from swing_screener.data.source_health import DataSourceHealth
from swing_screener.data.providers import MarketDataProvider
from swing_screener.recommendation.models import DecisionSummary


def _ohlcv_with_spy() -> pd.DataFrame:
    idx = pd.date_range("2024-01-01", periods=3, freq="D")
    close = pd.Series([100.0, 101.0, 102.0], index=idx, dtype=float)
    data = {
        ("Close", "ACWI"): close,
        ("Open", "ACWI"): close,
        ("High", "ACWI"): close + 1.0,
        ("Low", "ACWI"): close - 1.0,
        ("Volume", "ACWI"): pd.Series(1_000_000, index=idx, dtype=float),
        ("Close", "SPY"): close,
        ("Open", "SPY"): close,
        ("High", "SPY"): close + 1.0,
        ("Low", "SPY"): close - 1.0,
        ("Volume", "SPY"): pd.Series(1_000_000, index=idx, dtype=float),
    }
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def _ohlcv_with_symbol_and_spy() -> pd.DataFrame:
    idx = pd.date_range("2024-01-01", periods=3, freq="D")
    aaa = pd.Series([10.0, 11.0, 12.0], index=idx, dtype=float)
    acwi = pd.Series([100.0, 101.0, 102.0], index=idx, dtype=float)
    data = {
        ("Close", "AAA"): aaa,
        ("Open", "AAA"): aaa,
        ("High", "AAA"): aaa + 0.5,
        ("Low", "AAA"): aaa - 0.5,
        ("Volume", "AAA"): pd.Series(1_000_000, index=idx, dtype=float),
        ("Close", "ACWI"): acwi,
        ("Open", "ACWI"): acwi,
        ("High", "ACWI"): acwi + 1.0,
        ("Low", "ACWI"): acwi - 1.0,
        ("Volume", "ACWI"): pd.Series(1_000_000, index=idx, dtype=float),
        ("Close", "SPY"): acwi,
        ("Open", "SPY"): acwi,
        ("High", "SPY"): acwi + 1.0,
        ("Low", "SPY"): acwi - 1.0,
        ("Volume", "SPY"): pd.Series(1_000_000, index=idx, dtype=float),
    }
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def _ohlcv_with_abn_and_aex() -> pd.DataFrame:
    idx = pd.to_datetime(["2026-04-15", "2026-04-16"])
    abn = pd.Series([35.10, 35.42], index=idx, dtype=float)
    aex = pd.Series([920.0, 925.0], index=idx, dtype=float)
    data = {
        ("Close", "ABN.AS"): abn,
        ("Open", "ABN.AS"): abn,
        ("High", "ABN.AS"): abn + 0.2,
        ("Low", "ABN.AS"): abn - 0.2,
        ("Volume", "ABN.AS"): pd.Series([100_000, 120_000], index=idx, dtype=float),
        ("Close", "^AEX"): aex,
        ("Open", "^AEX"): aex,
        ("High", "^AEX"): aex + 2.0,
        ("Low", "^AEX"): aex - 2.0,
        ("Volume", "^AEX"): pd.Series([1_000_000, 1_100_000], index=idx, dtype=float),
    }
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def _create_mock_provider(ohlcv_data: pd.DataFrame) -> MarketDataProvider:
    """Create a mock provider that returns the given OHLCV data."""
    mock_provider = MagicMock(spec=MarketDataProvider)
    mock_provider.fetch_ohlcv.return_value = ohlcv_data
    mock_provider.get_provider_name.return_value = "mock"
    mock_provider.get_source_health.return_value = DataSourceHealth(
        provider="mock",
        domain="market_data",
        status="ok",
        quality_score=0.7,
        delay_policy="test_fixture",
    )
    return mock_provider


@pytest.fixture(autouse=True)
def _stub_earnings_proximity(monkeypatch):
    monkeypatch.setattr(
        screener_service,
        "fetch_next_earnings_days",
        lambda tickers, finnhub_api_key, asof_date, **kwargs: {ticker: None for ticker in tickers},
    )


def test_screener_top_over_100_returns_candidates(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        idx = [f"T{i:03d}" for i in range(150)]
        data = {
            "atr14": [1.2] * len(idx),
            "mom_6m": [0.1] * len(idx),
            "mom_12m": [0.2] * len(idx),
            "rs_6m": [0.05] * len(idx),
            "score": [0.5] * len(idx),
            "confidence": [60.0] * len(idx),
            "last": [50.0] * len(idx),
            "ma20_level": [48.0] * len(idx),
            "dist_sma50_pct": [5.0] * len(idx),
            "dist_sma200_pct": [10.0] * len(idx),
            "rank": list(range(1, len(idx) + 1)),
        }
        return pd.DataFrame(data, index=idx)

    # Mock the provider factory to return our mock provider
    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 200})
    assert res.status_code == 200
    data = res.json()
    assert len(data["candidates"]) == 150
    assert any("Only 150 candidates found for top 200." in w for w in data["warnings"])
    assert data["candidates"][0]["last_bar"] == "2024-01-03T00:00:00"
    # Synthetic test tickers (T000...) have no instrument master entry → UNKNOWN
    assert data["candidates"][0]["currency"] in ("USD", "UNKNOWN")
    assert "price_history" in data["candidates"][0]
    assert isinstance(data["candidates"][0]["price_history"], list)


def test_screener_empty_ohlcv_returns_404(monkeypatch):
    empty_df = pd.DataFrame()
    mock_provider = _create_mock_provider(empty_df)
    
    # Mock the provider factory to return our mock provider
    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 200})
    assert res.status_code == 404


def test_screener_recommendation_payload_shape(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        idx = ["AAA"]
        data = {
            "atr14": [1.2],
            "mom_6m": [0.1],
            "mom_12m": [0.2],
            "rs_6m": [0.05],
            "score": [0.55],
            "confidence": [60.0],
            "last": [50.0],
            "ma20_level": [48.0],
            "dist_sma50_pct": [5.0],
            "dist_sma200_pct": [10.0],
            "rank": [1],
            "signal": ["breakout"],
            "entry": [50.0],
            "stop": [48.0],
            "shares": [10],
            "position_value": [500.0],
            "realized_risk": [20.0],
            "suggested_order_type": ["BUY_STOP"],
            "suggested_order_price": [50.1],
            "execution_note": ["Breakout not triggered yet. Place BUY STOP slightly above breakout_level."],
        }
        return pd.DataFrame(data, index=idx)

    # Mock the provider factory to return our mock provider
    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 20})
    assert res.status_code == 200

    candidate = res.json()["candidates"][0]
    rec = candidate["recommendation"]

    assert rec["verdict"] in {"RECOMMENDED", "NOT_RECOMMENDED"}
    assert isinstance(rec["reasons_short"], list)
    assert isinstance(rec["reasons_detailed"], list)
    assert "risk" in rec
    assert "costs" in rec
    assert "checklist" in rec
    assert "education" in rec
    assert rec["risk"]["entry"] == 50.0
    assert rec["risk"]["stop"] == 48.0
    assert isinstance(rec["risk"]["shares"], int) and rec["risk"]["shares"] >= 0
    assert candidate["suggested_order_type"] == "BUY_STOP"
    assert candidate["suggested_order_price"] == 50.1
    assert "BUY STOP" in candidate["execution_note"]
    assert candidate["decision_summary"]["symbol"] == "AAA"
    assert candidate["decision_summary"]["action"] in {
        "BUY_NOW",
        "BUY_ON_PULLBACK",
        "WAIT_FOR_BREAKOUT",
        "WATCH",
        "TACTICAL_ONLY",
        "AVOID",
        "MANAGE_ONLY",
    }
    assert isinstance(rec["checklist"][0]["gate_name"], str)
    assert isinstance(rec["education"]["what_would_make_valid"], list)


def test_screener_response_includes_market_data_source_summary(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        return pd.DataFrame(
            {
                "atr14": [1.2],
                "mom_6m": [0.1],
                "mom_12m": [0.2],
                "rs_6m": [0.05],
                "score": [0.55],
                "confidence": [60.0],
                "last": [50.0],
                "ma20_level": [48.0],
                "dist_sma50_pct": [5.0],
                "dist_sma200_pct": [10.0],
                "rank": [1],
            },
            index=["AAA"],
        )

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 1})
    assert res.status_code == 200

    candidate = res.json()["candidates"][0]
    market_data = candidate["data_source_summary"]["market_data"]
    assert market_data["provider"] == "mock"
    assert market_data["status"] in {"ok", "degraded", "failed", "unknown"}
    assert 0 <= market_data["quality_score"] <= 1


def test_screener_candidate_includes_days_to_earnings(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        return pd.DataFrame(
            {
                "atr14": [1.2],
                "mom_6m": [0.1],
                "mom_12m": [0.2],
                "rs_6m": [0.05],
                "score": [0.55],
                "confidence": [60.0],
                "last": [50.0],
                "ma20_level": [48.0],
                "dist_sma50_pct": [5.0],
                "dist_sma200_pct": [10.0],
                "rank": [1],
            },
            index=["AAA"],
        )

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})
    monkeypatch.setattr(
        "api.services.screener_service.fetch_next_earnings_days",
        lambda tickers, finnhub_api_key, asof_date, **kwargs: {"AAA": 12},
    )

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 1})
    assert res.status_code == 200
    candidate = res.json()["candidates"][0]
    assert candidate.get("days_to_earnings") == 12


def test_screener_candidate_includes_sector_rotation_context(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)
    captured: dict[str, object] = {}

    def fake_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        captured["sector_benchmark_returns"] = sector_benchmark_returns
        return pd.DataFrame(
            {
                "atr14": [1.2],
                "mom_6m": [0.10],
                "mom_12m": [0.20],
                "rs_6m": [0.05],
                "sector_rs_6m": [0.03],
                "score": [0.55],
                "confidence": [60.0],
                "last": [50.0],
                "ma20_level": [48.0],
                "dist_sma50_pct": [5.0],
                "dist_sma200_pct": [10.0],
                "rank": [1],
            },
            index=["AAA"],
        )

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_report)
    monkeypatch.setattr(
        screener_service,
        "get_multiple_ticker_info",
        lambda tickers: {"AAA": {"sector": "Technology"}},
    )

    from swing_screener.data import sector_rotation as sr

    monkeypatch.setattr(sr, "compute_sector_benchmark_returns", lambda ohlcv, **kw: {"XLK": 0.07})
    monkeypatch.setattr(
        sr,
        "compute_sector_rotation_scores",
        lambda ohlcv, **kw: {"XLK": {"fast_rs": 0.04, "slow_rs": 0.02, "in_rotation": True}},
    )

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"tickers": ["AAA"], "top": 1})
    assert res.status_code == 200
    candidate = res.json()["candidates"][0]
    assert candidate["sector_rotation_context"] == {
        "fast_rs": 0.04,
        "slow_rs": 0.02,
        "in_rotation": True,
    }
    assert candidate["sector_rs"] == pytest.approx(0.03)
    assert captured["sector_benchmark_returns"] == {"AAA": 0.07}


def test_screener_filters_candidates_too_close_to_earnings(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        return pd.DataFrame(
            {
                "atr14": [1.2, 1.2],
                "mom_6m": [0.1, 0.1],
                "mom_12m": [0.2, 0.2],
                "rs_6m": [0.05, 0.05],
                "score": [0.55, 0.55],
                "confidence": [60.0, 59.0],
                "last": [50.0, 51.0],
                "ma20_level": [48.0, 49.0],
                "dist_sma50_pct": [5.0, 5.0],
                "dist_sma200_pct": [10.0, 10.0],
                "rank": [1, 2],
            },
            index=["AAA", "BBB"],
        )

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})
    monkeypatch.setattr(screener_service, "_min_days_to_earnings_default", lambda: 10)
    monkeypatch.setattr(
        "api.services.screener_service.fetch_next_earnings_days",
        lambda tickers, finnhub_api_key, asof_date, **kwargs: {"AAA": 5, "BBB": 12},
    )

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 2})
    assert res.status_code == 200
    candidates = res.json()["candidates"]
    assert [candidate["ticker"] for candidate in candidates] == ["BBB"]
    assert candidates[0]["days_to_earnings"] == 12


def test_screener_attaches_benchmark_comparison(monkeypatch):
    ohlcv = _ohlcv_with_symbol_and_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        idx = ["AAA"]
        data = {
            "atr14": [1.2],
            "mom_6m": [0.1],
            "mom_12m": [0.2],
            "rs_6m": [0.05],
            "score": [0.55],
            "confidence": [60.0],
            "last": [12.0],
            "ma20_level": [11.0],
            "dist_sma50_pct": [5.0],
            "dist_sma200_pct": [10.0],
            "rank": [1],
        }
        return pd.DataFrame(data, index=idx)

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 20})
    assert res.status_code == 200

    payload = res.json()
    candidate = payload["candidates"][0]

    assert payload["benchmark_ticker"] == "ACWI"
    assert payload["benchmark_change_pct"] == 2.0
    assert candidate["symbol_change_pct"] == 20.0
    assert candidate["benchmark_outperformance_pct"] == 18.0
    assert [point["close"] for point in candidate["benchmark_price_history"]] == pytest.approx([10.0, 10.1, 10.2])


def test_screener_response_is_prioritized_by_decision_action_and_conviction(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        idx = ["AAA", "BBB", "CCC"]
        data = {
            "atr14": [1.2, 1.2, 1.2],
            "mom_6m": [0.1, 0.1, 0.1],
            "mom_12m": [0.2, 0.2, 0.2],
            "rs_6m": [0.05, 0.05, 0.05],
            "score": [0.55, 0.55, 0.55],
            "confidence": [95.0, 90.0, 85.0],
            "last": [50.0, 50.0, 50.0],
            "ma20_level": [48.0, 48.0, 48.0],
            "dist_sma50_pct": [5.0, 5.0, 5.0],
            "dist_sma200_pct": [10.0, 10.0, 10.0],
            "rank": [1, 2, 3],
        }
        return pd.DataFrame(data, index=idx)

    def fake_apply_decision_summary_context(candidates, **kwargs):
        decision_map = {
            "AAA": ("WATCH", "high"),
            "BBB": ("BUY_NOW", "medium"),
            "CCC": ("BUY_NOW", "high"),
        }
        enriched = []
        for candidate in candidates:
            action, conviction = decision_map[candidate.ticker]
            enriched.append(
                candidate.model_copy(
                    update={
                        "decision_summary": DecisionSummary(
                            symbol=candidate.ticker,
                            action=action,
                            conviction=conviction,
                            technical_label="strong",
                            fundamentals_label="strong",
                            valuation_label="fair",
                            catalyst_label="active",
                            why_now="Why now.",
                            what_to_do="What to do.",
                            main_risk="Main risk.",
                        )
                    }
                )
            )
        return enriched

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})
    monkeypatch.setattr(screener_service, "apply_decision_summary_context", fake_apply_decision_summary_context)

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 20})
    assert res.status_code == 200

    candidates = res.json()["candidates"]
    assert [candidate["ticker"] for candidate in candidates] == ["CCC", "BBB", "AAA"]
    assert [candidate["priority_rank"] for candidate in candidates] == [1, 2, 3]
    assert [candidate["rank"] for candidate in candidates] == [3, 2, 1]


def test_screener_currency_comes_from_metadata(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        idx = ["ASML.AS"]
        data = {
            "atr14": [1.2],
            "mom_6m": [0.1],
            "mom_12m": [0.2],
            "rs_6m": [0.05],
            "score": [0.55],
            "confidence": [60.0],
            "last": [50.0],
            "ma20_level": [48.0],
            "dist_sma50_pct": [5.0],
            "dist_sma200_pct": [10.0],
            "rank": [1],
        }
        return pd.DataFrame(data, index=idx)

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(
        screener_service,
        "get_multiple_ticker_info",
        lambda tickers: {"ASML.AS": {"name": "ASML", "sector": "Technology", "currency": "EUR"}},
    )

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 20})
    assert res.status_code == 200
    candidate = res.json()["candidates"][0]
    assert candidate["currency"] == "EUR"


def test_screener_request_currency_filter_overrides_strategy(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)
    captured = {}

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        captured["currencies"] = cfg.universe.filt.currencies
        idx = ["AAPL"]
        data = {
            "atr14": [1.2],
            "mom_6m": [0.1],
            "mom_12m": [0.2],
            "rs_6m": [0.05],
            "score": [0.55],
            "confidence": [60.0],
            "last": [50.0],
            "ma20_level": [48.0],
            "dist_sma50_pct": [5.0],
            "dist_sma200_pct": [10.0],
            "rank": [1],
        }
        return pd.DataFrame(data, index=idx)

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})

    client = TestClient(app)
    res = client.post(
        "/api/screener/run",
        json={"universe": "broad_market_stocks", "top": 20, "currencies": ["EUR"]},
    )
    assert res.status_code == 200
    assert captured["currencies"] == ["EUR"]


def test_screener_exchange_filter_reduces_working_list(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    captured: dict[str, list[str]] = {}
    mock_provider = _create_mock_provider(ohlcv)

    def fake_fetch_ohlcv(tickers, start_date=None, end_date=None, force_refresh=False):
        del start_date, end_date, force_refresh
        captured["tickers"] = list(tickers)
        return ohlcv

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        del ohlcv, cfg, exclude_tickers
        return pd.DataFrame(
            {
                "atr14": [1.2],
                "mom_6m": [0.1],
                "mom_12m": [0.2],
                "rs_6m": [0.05],
                "score": [0.55],
                "confidence": [60.0],
                "last": [50.0],
                "ma20_level": [48.0],
                "dist_sma50_pct": [5.0],
                "dist_sma200_pct": [10.0],
                "rank": [1],
            },
            index=["AAPL"],
        )

    mock_provider.fetch_ohlcv.side_effect = fake_fetch_ohlcv
    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "load_universe_from_package", lambda name, cfg: ["AAPL", "ASML.AS", "ACWI"])
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})

    client = TestClient(app)
    res = client.post(
        "/api/screener/run",
        json={
            "universe": "broad_market_stocks",
            "top": 20,
            "exchange_mics": ["XNAS", "XNYS"],
            "include_otc": False,
        },
    )
    assert res.status_code == 200
    assert captured["tickers"] == ["AAPL", "ACWI"]
    assert "reduced the working list" in res.json()["warnings"][0].lower()


def test_screener_returns_same_symbol_add_on_metadata(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        idx = ["REP.MC"]
        data = {
            "atr14": [0.8],
            "mom_6m": [0.15],
            "mom_12m": [0.25],
            "rs_6m": [0.05],
            "score": [0.994],
            "confidence": [92.7],
            "last": [23.0],
            "ma20_level": [22.0],
            "dist_sma50_pct": [9.5],
            "dist_sma200_pct": [22.0],
            "rank": [1],
            "signal": ["breakout"],
            "entry": [22.83],
            "stop": [21.62],
            "shares": [5],
            "position_value": [114.15],
            "realized_risk": [6.05],
            "suggested_order_type": ["BUY_LIMIT"],
            "suggested_order_price": [22.83],
            "execution_note": ["Pullback setup."],
        }
        return pd.DataFrame(data, index=idx)

    class StubPortfolioService:
        def list_positions(self, status=None):
            del status
            return SimpleNamespace(
                positions=[
                    SimpleNamespace(
                        ticker="REP.MC",
                        status="open",
                        position_id="POS-REP-1",
                        entry_price=19.63,
                        current_price=23.0,
                        stop_price=19.63,
                        shares=5,
                        current_value=115.0,
                    )
                ]
            )

        def list_orders(self, status=None, ticker=None):
            del status, ticker
            return SimpleNamespace(orders=[])

        def suggest_position_stop(self, position_id):
            del position_id
            return SimpleNamespace(action="NO_ACTION")

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(
        screener_service,
        "get_multiple_ticker_info",
        lambda tickers: {"REP.MC": {"name": "Repsol", "sector": "Energy", "currency": "EUR"}},
    )

    app.dependency_overrides[get_portfolio_service] = lambda: StubPortfolioService()
    try:
        client = TestClient(app)
        res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 20})
        assert res.status_code == 200

        body = res.json()
        assert body["same_symbol_add_on_count"] == 1
        assert body["same_symbol_suppressed_count"] == 0
        assert body["candidates"][0]["same_symbol"]["mode"] == "ADD_ON"
        assert body["candidates"][0]["same_symbol"]["current_position_stop"] == 19.63
        assert body["candidates"][0]["same_symbol"]["fresh_setup_stop"] == 21.62
        assert body["candidates"][0]["recommendation"]["risk"]["stop"] == 19.63
    finally:
        app.dependency_overrides.pop(get_portfolio_service, None)


def test_screener_anchors_entry_stop_to_structural_pattern_stop(monkeypatch):
    """A valid, tighter structural (pattern) stop becomes the entry stop used by
    the recommendation/order, with risk recomputed from it (share count kept)."""
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        idx = ["REP.MC"]
        data = {
            "atr14": [0.8],
            "mom_6m": [0.15],
            "mom_12m": [0.25],
            "rs_6m": [0.05],
            "score": [0.994],
            "confidence": [92.7],
            "last": [23.0],
            "ma20_level": [22.0],
            "dist_sma50_pct": [9.5],
            "dist_sma200_pct": [22.0],
            "rank": [1],
            "signal": ["breakout"],
            "entry": [22.83],
            "stop": [21.62],
            "shares": [5],
            "position_value": [114.15],
            "realized_risk": [6.05],
            "suggested_order_type": ["BUY_LIMIT"],
            "suggested_order_price": [22.83],
            "execution_note": ["Pullback setup."],
        }
        return pd.DataFrame(data, index=idx)

    class StubPortfolioService:
        def list_positions(self, status=None):
            del status
            return SimpleNamespace(positions=[])

        def list_orders(self, status=None, ticker=None):
            del status, ticker
            return SimpleNamespace(orders=[])

        def suggest_position_stop(self, position_id):
            del position_id
            return SimpleNamespace(action="NO_ACTION")

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(
        screener_service,
        "get_multiple_ticker_info",
        lambda tickers: {"REP.MC": {"name": "Repsol", "sector": "Energy", "currency": "EUR"}},
    )
    # Force a valid, tighter structural stop (above the 21.62 ATR stop, below entry).
    monkeypatch.setattr(
        screener_service,
        "apply_pattern_stop",
        lambda **kwargs: (22.20, "Stop below hammer low (at breakout)"),
    )

    app.dependency_overrides[get_portfolio_service] = lambda: StubPortfolioService()
    try:
        client = TestClient(app)
        res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 20})
        assert res.status_code == 200

        candidate = res.json()["candidates"][0]
        # Entry stop is now the structural pattern stop, not the wide ATR stop.
        assert candidate["stop"] == 22.20
        assert candidate["recommendation"]["risk"]["stop"] == 22.20
        assert candidate["pattern_stop"] == 22.20
        # Share count is unchanged; risk is recomputed from the tighter stop.
        assert candidate["shares"] == 5
        assert candidate["risk_usd"] == pytest.approx((22.83 - 22.20) * 5, abs=1e-6)
    finally:
        app.dependency_overrides.pop(get_portfolio_service, None)


def test_screener_loads_each_fundamentals_snapshot_once(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)
    load_calls: list[str] = []

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        idx = ["AAA", "BBB"]
        data = {
            "atr14": [1.2, 1.1],
            "mom_6m": [0.1, 0.1],
            "mom_12m": [0.2, 0.2],
            "rs_6m": [0.05, 0.04],
            "score": [0.5, 0.4],
            "confidence": [80.0, 70.0],
            "last": [20.0, 21.0],
            "ma20_level": [19.0, 20.0],
            "dist_sma50_pct": [5.0, 5.0],
            "dist_sma200_pct": [15.0, 15.0],
            "rank": [1, 2],
            "signal": ["breakout", "breakout"],
        }
        return pd.DataFrame(data, index=idx)

    def fake_load_snapshot(self, symbol):
        load_calls.append(symbol)
        return None

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})
    monkeypatch.setattr(decision_context.FundamentalsStorage, "load_snapshot", fake_load_snapshot)

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 5})
    assert res.status_code == 200
    assert len(res.json()["candidates"]) == 2

    assert sorted(load_calls) == ["AAA", "BBB"]


def test_resolve_fetch_start_date_covers_min_history():
    start = resolve_fetch_start_date("2026-03-02", 260)
    asof = dt.date.fromisoformat("2026-03-02")
    window_days = (asof - dt.date.fromisoformat(start)).days
    # Enough calendar days to yield >= 260 trading bars, but no multi-year window
    assert window_days >= 260 * 1.4
    assert window_days <= 600


def test_resolve_fetch_start_date_grows_with_min_history():
    short = resolve_fetch_start_date("2026-03-02", 260)
    long = resolve_fetch_start_date("2026-03-02", 400)
    assert dt.date.fromisoformat(long) < dt.date.fromisoformat(short)


def test_screener_fetches_rolling_window_not_fixed_start(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)
    captured: dict = {}

    original_return = mock_provider.fetch_ohlcv.return_value

    def record_fetch(tickers, start_date=None, end_date=None, **kwargs):
        captured.setdefault("start_dates", []).append(start_date)
        return original_return

    mock_provider.fetch_ohlcv.side_effect = record_fetch

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        return pd.DataFrame()

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})

    client = TestClient(app)
    res = client.post(
        "/api/screener/run",
        json={"universe": "broad_market_stocks", "top": 5, "asof_date": "2026-03-02"},
    )
    assert res.status_code == 200

    assert captured["start_dates"]
    for start in captured["start_dates"]:
        assert start == resolve_fetch_start_date("2026-03-02", 260)


def test_screener_widens_ranking_pool_for_combined_priority(monkeypatch):
    """Stage 1 must rank a pool of top * prefilter_multiplier candidates so the
    combined-priority stage can actually re-rank beyond the requested top-N."""
    from swing_screener.recommendation.priority import CombinedPriorityConfig

    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)
    captured: dict = {}

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        captured["ranking_top_n"] = cfg.ranking.top_n
        idx = [f"T{i:03d}" for i in range(min(cfg.ranking.top_n, 200))]
        data = {
            "atr14": [1.2] * len(idx),
            "mom_6m": [0.1] * len(idx),
            "mom_12m": [0.2] * len(idx),
            "rs_6m": [0.05] * len(idx),
            "score": [0.5] * len(idx),
            "confidence": [80.0 - i for i in range(len(idx))],
            "last": [20.0] * len(idx),
            "ma20_level": [19.0] * len(idx),
            "dist_sma50_pct": [5.0] * len(idx),
            "dist_sma200_pct": [15.0] * len(idx),
            "rank": list(range(1, len(idx) + 1)),
            "signal": ["breakout"] * len(idx),
        }
        return pd.DataFrame(data, index=idx)

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 50})
    assert res.status_code == 200

    multiplier = CombinedPriorityConfig().prefilter_multiplier
    assert captured["ranking_top_n"] >= 50 * multiplier
    assert len(res.json()["candidates"]) == 50



def test_screener_pending_entry_order_blocks_add_on(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        idx = ["REP.MC"]
        data = {
            "atr14": [0.8],
            "mom_6m": [0.15],
            "mom_12m": [0.25],
            "rs_6m": [0.05],
            "score": [0.994],
            "confidence": [92.7],
            "last": [23.0],
            "ma20_level": [22.0],
            "dist_sma50_pct": [9.5],
            "dist_sma200_pct": [22.0],
            "rank": [1],
            "signal": ["breakout"],
            "entry": [22.83],
            "stop": [21.62],
            "shares": [5],
            "position_value": [114.15],
            "realized_risk": [6.05],
        }
        return pd.DataFrame(data, index=idx)

    class StubPortfolioService:
        def list_positions(self, status=None):
            del status
            return SimpleNamespace(
                positions=[
                    SimpleNamespace(
                        ticker="REP.MC",
                        status="open",
                        position_id="POS-REP-1",
                        entry_price=19.63,
                        current_price=23.0,
                        stop_price=19.63,
                        shares=5,
                        current_value=115.0,
                    )
                ]
            )

        def suggest_position_stop(self, position_id):
            del position_id
            return SimpleNamespace(action="NO_ACTION")

    class StubOrdersService:
        def list_local_orders(self, status=None):
            del status
            return {
                "orders": [
                    {
                        "ticker": "REP.MC",
                        "status": "pending",
                        "order_kind": "entry",
                        "position_id": None,
                    }
                ]
            }

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(
        screener_service,
        "get_multiple_ticker_info",
        lambda tickers: {"REP.MC": {"name": "Repsol", "sector": "Energy", "currency": "EUR"}},
    )

    app.dependency_overrides[get_portfolio_service] = lambda: StubPortfolioService()
    app.dependency_overrides[get_orders_service] = lambda: StubOrdersService()
    try:
        client = TestClient(app)
        res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 20})
        assert res.status_code == 200

        body = res.json()
        assert body["same_symbol_add_on_count"] == 0
        candidate = body["candidates"][0]
        assert candidate["same_symbol"]["pending_entry_exists"] is True
        assert candidate["same_symbol"]["mode"] == "MANAGE_ONLY"
    finally:
        app.dependency_overrides.pop(get_portfolio_service, None)
        app.dependency_overrides.pop(get_orders_service, None)


def test_screener_invalid_currency_rejected():
    client = TestClient(app)
    res = client.post(
        "/api/screener/run",
        json={"universe": "broad_market_stocks", "top": 20, "currencies": ["JPY"]},
    )
    assert res.status_code == 422


def test_default_asof_uses_previous_day_before_eur_close():
    now_utc = dt.datetime(2026, 2, 19, 15, 0, tzinfo=dt.timezone.utc)
    resolved = resolve_default_asof_date(now_utc, ["EUR"])
    assert resolved.isoformat() == "2026-02-18"


def test_default_asof_uses_same_day_after_eur_close():
    now_utc = dt.datetime(2026, 2, 19, 18, 0, tzinfo=dt.timezone.utc)
    resolved = resolve_default_asof_date(now_utc, ["EUR"])
    assert resolved.isoformat() == "2026-02-19"


def test_data_freshness_is_intraday_for_today_before_close():
    now_utc = dt.datetime(2026, 2, 19, 15, 0, tzinfo=dt.timezone.utc)
    freshness = resolve_data_freshness("2026-02-19", now_utc, ["EUR"])
    assert freshness == "intraday"


def test_screener_uses_universe_currency_for_european_close(monkeypatch):
    class FrozenDateTime(dt.datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 4, 16, 16, 5, tzinfo=tz or dt.timezone.utc)

    monkeypatch.setattr(screener_service.dt, "datetime", FrozenDateTime)

    ohlcv = _ohlcv_with_abn_and_aex()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        idx = ["ABN.AS"]
        data = {
            "atr14": [1.0],
            "mom_6m": [0.1],
            "mom_12m": [0.2],
            "rs_6m": [0.05],
            "score": [0.8],
            "confidence": [70.0],
            "last": [35.42],
            "ma20_level": [35.10],
            "dist_sma50_pct": [4.0],
            "dist_sma200_pct": [8.0],
            "rank": [1],
            "signal": ["buy_now"],
            "entry": [35.42],
            "stop": [34.0],
            "shares": [100],
            "position_value": [3542.0],
            "realized_risk": [142.0],
            "suggested_order_type": ["BUY_LIMIT"],
            "suggested_order_price": [35.18],
            "execution_note": ["European session is closed; use the latest same-day close."],
        }
        return pd.DataFrame(data, index=idx)

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(
        screener_service,
        "get_multiple_ticker_info",
        lambda tickers: {"ABN.AS": {"name": "ABN AMRO BANK N.V.", "currency": "EUR"}},
    )

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "amsterdam_aex", "top": 20})
    assert res.status_code == 200
    payload = res.json()

    assert payload["asof_date"] == "2026-04-16"
    assert payload["data_freshness"] == "final_close"
    assert payload["candidates"][0]["ticker"] == "ABN.AS"
    assert payload["candidates"][0]["last_bar"] == "2026-04-16T00:00:00"


def test_screener_async_mode_returns_job_and_status(monkeypatch):
    monkeypatch.setenv("SCREENER_RUN_MODE", "async")

    def fake_run(self, request, strategy_override=None):
        return ScreenerResponse(
            candidates=[],
            asof_date="2026-02-26",
            total_screened=0,
            data_freshness="final_close",
            warnings=[],
        )

    monkeypatch.setattr(screener_service.ScreenerService, "run_screener", fake_run)

    client = TestClient(app)
    launch_res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 20})
    assert launch_res.status_code == 202
    launch_payload = launch_res.json()
    assert launch_payload["status"] in {"queued", "running", "completed"}
    job_id = launch_payload["job_id"]

    final_payload = None
    for _ in range(20):
        status_res = client.get(f"/api/screener/run/{job_id}")
        assert status_res.status_code == 200
        payload = status_res.json()
        if payload["status"] == "completed":
            final_payload = payload
            break
        time.sleep(0.05)

    assert final_payload is not None
    assert final_payload["result"]["asof_date"] == "2026-02-26"
    assert final_payload["result"]["total_screened"] == 0


def test_screener_async_mode_records_history(monkeypatch):
    from api.dependencies import get_screener_history_repo
    from api.models.screener import ScreenerCandidate

    monkeypatch.setenv("SCREENER_RUN_MODE", "async")

    candidate = ScreenerCandidate(
        ticker="AAA",
        close=20.0,
        sma_20=19.0,
        sma_50=18.0,
        sma_200=15.0,
        atr=1.0,
        momentum_6m=0.1,
        momentum_12m=0.2,
        rel_strength=0.05,
        score=0.5,
        confidence=80.0,
        rank=1,
    )

    def fake_run(self, request, strategy_override=None):
        return ScreenerResponse(
            candidates=[candidate],
            asof_date="2026-02-26",
            total_screened=1,
            data_freshness="final_close",
            warnings=[],
        )

    monkeypatch.setattr(screener_service.ScreenerService, "run_screener", fake_run)

    recorded: list[tuple[str, list[str]]] = []

    class StubHistoryRepo:
        def record_run(self, asof_date, tickers):
            recorded.append((asof_date, list(tickers)))

    app.dependency_overrides[get_screener_history_repo] = lambda: StubHistoryRepo()
    try:
        client = TestClient(app)
        launch_res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 20})
        assert launch_res.status_code == 202
        job_id = launch_res.json()["job_id"]

        for _ in range(40):
            payload = client.get(f"/api/screener/run/{job_id}").json()
            if payload["status"] in {"completed", "error"}:
                break
            time.sleep(0.05)

        assert payload["status"] == "completed"
        assert recorded == [("2026-02-26", ["AAA"])]
    finally:
        app.dependency_overrides.pop(get_screener_history_repo, None)


def test_screener_run_endpoint_does_not_block_event_loop():
    """The sync screener run takes minutes; the handler must be a plain def so
    FastAPI executes it in the threadpool instead of blocking the event loop.

    Asserts on the endpoint function directly rather than walking ``app.routes``:
    FastAPI decides threadpool-vs-event-loop via ``iscoroutinefunction`` on this
    exact function, and Starlette 1.x no longer flattens included routers into
    ``app.routes`` (they are wrapped in an opaque router object)."""
    import inspect

    from api.routers.screener import run_screener

    assert not inspect.iscoroutinefunction(run_screener)


def test_screener_universes_route_removed_in_favor_of_canonical_universes():
    client = TestClient(app)

    removed = client.get("/api/screener/universes")
    assert removed.status_code == 404

    canonical = client.get("/api/universes")
    assert canonical.status_code == 200
    body = canonical.json()
    assert isinstance(body["universes"], list)
    assert body["universes"][0]["id"]
    assert "member_count" in body["universes"][0]
    assert "exchange_mics" in body["universes"][0]


def test_screener_run_returns_422_for_removed_universe_with_replacement():
    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "mega_all", "top": 20})
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert "mega_all" in detail
    assert "broad_market_stocks" in detail


def test_screener_run_returns_422_for_removed_universe_no_replacement():
    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "eur_all", "top": 20})
    assert res.status_code == 422
    assert "eur_all" in res.json()["detail"]


def test_screener_run_returns_422_for_unknown_universe():
    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "totally_unknown_id", "top": 20})
    assert res.status_code == 422


def test_screener_candidate_has_weekly_trend_field():
    """ScreenerCandidate model exposes weekly_trend field."""
    from api.models.screener import ScreenerCandidate

    c = ScreenerCandidate(
        ticker="AAA",
        close=30.0,
        sma_20=28.0,
        sma_50=25.0,
        sma_200=22.0,
        atr=1.5,
        momentum_6m=0.1,
        momentum_12m=0.2,
        rel_strength=0.05,
        score=0.75,
        confidence=0.75,
        rank=1,
        weekly_trend="up",
    )
    assert c.weekly_trend == "up"
    data = c.model_dump()
    assert data["weekly_trend"] == "up"


def test_screener_request_has_require_weekly_uptrend_field():
    """ScreenerRequest model accepts require_weekly_uptrend."""
    from api.models.screener import ScreenerRequest

    req = ScreenerRequest(require_weekly_uptrend=True)
    assert req.require_weekly_uptrend is True
    req_default = ScreenerRequest()
    assert req_default.require_weekly_uptrend is None


def test_screener_require_weekly_uptrend_overrides_strategy(monkeypatch):
    """require_weekly_uptrend=True in request sets universe_cfg.filt.require_weekly_uptrend."""
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)
    captured: list = []

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, sector_benchmark_returns=None, **kwargs):
        captured.append(cfg)
        idx = ["AAPL"]
        data = {
            "atr14": [1.2],
            "mom_6m": [0.1],
            "mom_12m": [0.2],
            "rs_6m": [0.05],
            "score": [0.55],
            "confidence": [60.0],
            "last": [50.0],
            "ma20_level": [48.0],
            "dist_sma50_pct": [5.0],
            "dist_sma200_pct": [10.0],
            "rank": [1],
        }
        return pd.DataFrame(data, index=idx)

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})

    client = TestClient(app)
    res = client.post(
        "/api/screener/run",
        json={"universe": "broad_market_stocks", "top": 5, "require_weekly_uptrend": True},
    )
    assert res.status_code == 200
    assert captured, "build_daily_report was never called"
    assert captured[0].universe.filt.require_weekly_uptrend is True


def test_screener_preview_order_route_removed():
    client = TestClient(app)
    response = client.post(
        "/api/screener/preview-order",
        json={
            "ticker": "AAPL",
            "entry_price": 200,
            "stop_price": 190,
            "account_size": 50_000,
            "risk_pct": 0.01,
        },
    )

    assert response.status_code == 404


def test_screener_candidate_includes_52w_high_fields(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None, **kwargs):
        return pd.DataFrame(
            {
                "atr14": [1.2],
                "mom_6m": [0.1],
                "mom_12m": [0.2],
                "rs_6m": [0.05],
                "score": [0.55],
                "confidence": [60.0],
                "last": [50.0],
                "ma20_level": [48.0],
                "dist_sma50_pct": [5.0],
                "dist_sma200_pct": [10.0],
                "rank": [1],
                "dist_52w_high_pct": [-0.03],
                "near_52w_high": [True],
            },
            index=["AAA"],
        )

    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "broad_market_stocks", "top": 1})
    assert res.status_code == 200
    candidate = res.json()["candidates"][0]
    assert "dist_52w_high_pct" in candidate
    assert candidate["dist_52w_high_pct"] == pytest.approx(-0.03, abs=1e-4)
    assert candidate["near_52w_high"] is True
