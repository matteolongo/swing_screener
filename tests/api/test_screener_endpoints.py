import pandas as pd
import datetime as dt
import time
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from types import SimpleNamespace

from api.main import app
from api.dependencies import get_portfolio_service
import api.services.screener_service as screener_service
from api.models.screener import ScreenerResponse
from swing_screener.data.providers import MarketDataProvider
from swing_screener.recommendation.models import DecisionSummary


def _ohlcv_with_spy() -> pd.DataFrame:
    idx = pd.date_range("2024-01-01", periods=3, freq="D")
    close = pd.Series([100.0, 101.0, 102.0], index=idx, dtype=float)
    data = {
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
    spy = pd.Series([100.0, 101.0, 102.0], index=idx, dtype=float)
    data = {
        ("Close", "AAA"): aaa,
        ("Open", "AAA"): aaa,
        ("High", "AAA"): aaa + 0.5,
        ("Low", "AAA"): aaa - 0.5,
        ("Volume", "AAA"): pd.Series(1_000_000, index=idx, dtype=float),
        ("Close", "SPY"): spy,
        ("Open", "SPY"): spy,
        ("High", "SPY"): spy + 1.0,
        ("Low", "SPY"): spy - 1.0,
        ("Volume", "SPY"): pd.Series(1_000_000, index=idx, dtype=float),
    }
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def _create_mock_provider(ohlcv_data: pd.DataFrame) -> MarketDataProvider:
    """Create a mock provider that returns the given OHLCV data."""
    mock_provider = MagicMock(spec=MarketDataProvider)
    mock_provider.fetch_ohlcv.return_value = ohlcv_data
    mock_provider.get_provider_name.return_value = "mock"
    return mock_provider


def test_screener_top_over_100_returns_candidates(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None):
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
    assert data["warnings"] == ["Only 150 candidates found for top 200."]
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

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None):
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


def test_screener_attaches_benchmark_comparison(monkeypatch):
    ohlcv = _ohlcv_with_symbol_and_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None):
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

    assert payload["benchmark_ticker"] == "SPY"
    assert payload["benchmark_change_pct"] == 2.0
    assert candidate["symbol_change_pct"] == 20.0
    assert candidate["benchmark_outperformance_pct"] == 18.0
    assert [point["close"] for point in candidate["benchmark_price_history"]] == pytest.approx([10.0, 10.1, 10.2])


def test_screener_response_is_prioritized_by_decision_action_and_conviction(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None):
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
    monkeypatch.setattr(screener_service, "_apply_decision_summary_context", fake_apply_decision_summary_context)

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

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None):
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

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None):
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

    def fake_fetch_ohlcv(tickers, start_date=None, end_date=None):
        del start_date, end_date
        captured["tickers"] = list(tickers)
        return ohlcv

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None):
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
    monkeypatch.setattr(screener_service, "load_universe_from_package", lambda name, cfg: ["AAPL", "ASML.AS", "SPY"])
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
    assert captured["tickers"] == ["AAPL", "SPY"]
    assert "reduced the working list" in res.json()["warnings"][0].lower()


def test_screener_returns_same_symbol_add_on_metadata(monkeypatch):
    ohlcv = _ohlcv_with_spy()
    mock_provider = _create_mock_provider(ohlcv)

    def fake_build_daily_report(ohlcv, cfg, exclude_tickers=None):
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


def test_screener_invalid_currency_rejected():
    client = TestClient(app)
    res = client.post(
        "/api/screener/run",
        json={"universe": "broad_market_stocks", "top": 20, "currencies": ["JPY"]},
    )
    assert res.status_code == 422


def test_default_asof_uses_previous_day_before_eur_close():
    now_utc = dt.datetime(2026, 2, 19, 15, 0, tzinfo=dt.timezone.utc)
    resolved = screener_service._resolve_default_asof_date(now_utc, ["EUR"])
    assert resolved.isoformat() == "2026-02-18"


def test_default_asof_uses_same_day_after_eur_close():
    now_utc = dt.datetime(2026, 2, 19, 18, 0, tzinfo=dt.timezone.utc)
    resolved = screener_service._resolve_default_asof_date(now_utc, ["EUR"])
    assert resolved.isoformat() == "2026-02-19"


def test_data_freshness_is_intraday_for_today_before_close():
    now_utc = dt.datetime(2026, 2, 19, 15, 0, tzinfo=dt.timezone.utc)
    freshness = screener_service._resolve_data_freshness("2026-02-19", now_utc, ["EUR"])
    assert freshness == "intraday"


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


def test_list_universes_returns_metadata_objects():
    client = TestClient(app)
    res = client.get("/api/screener/universes")
    assert res.status_code == 200
    body = res.json()
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
