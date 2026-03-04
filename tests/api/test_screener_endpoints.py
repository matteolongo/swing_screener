import pandas as pd
import datetime as dt
import time
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from types import SimpleNamespace

from api.main import app
import api.services.screener_service as screener_service
from api.models.screener import ScreenerResponse
from swing_screener.data.providers import MarketDataProvider


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


def _create_mock_provider(ohlcv_data: pd.DataFrame) -> MarketDataProvider:
    """Create a mock provider that returns the given OHLCV data."""
    mock_provider = MagicMock(spec=MarketDataProvider)
    mock_provider.fetch_ohlcv.return_value = ohlcv_data
    mock_provider.get_provider_name.return_value = "mock"
    return mock_provider


def _disable_social_warmup(monkeypatch):
    monkeypatch.setattr(
        screener_service,
        "get_social_warmup_manager",
        lambda: SimpleNamespace(start_job=lambda **kwargs: None),
    )


def test_screener_top_over_100_returns_candidates(monkeypatch):
    _disable_social_warmup(monkeypatch)
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
    res = client.post("/api/screener/run", json={"universe": "mega_all", "top": 200})
    assert res.status_code == 200
    data = res.json()
    assert len(data["candidates"]) == 150
    assert data["warnings"] == ["Only 150 candidates found for top 200."]
    assert data["candidates"][0]["last_bar"] == "2024-01-03T00:00:00"
    assert data["candidates"][0]["currency"] == "USD"
    assert "price_history" in data["candidates"][0]
    assert isinstance(data["candidates"][0]["price_history"], list)


def test_screener_empty_ohlcv_returns_404(monkeypatch):
    _disable_social_warmup(monkeypatch)
    empty_df = pd.DataFrame()
    mock_provider = _create_mock_provider(empty_df)
    
    # Mock the provider factory to return our mock provider
    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "mega_all", "top": 200})
    assert res.status_code == 404


def test_screener_recommendation_payload_shape(monkeypatch):
    _disable_social_warmup(monkeypatch)
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
            "overlay_status": ["OK"],
            "overlay_reasons": [[]],
        }
        return pd.DataFrame(data, index=idx)

    # Mock the provider factory to return our mock provider
    monkeypatch.setattr(screener_service, "get_default_provider", lambda **kwargs: mock_provider)
    monkeypatch.setattr(screener_service, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_service, "get_multiple_ticker_info", lambda tickers: {})

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "mega_all", "top": 20})
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
    assert rec["risk"]["shares"] == 10
    assert candidate["suggested_order_type"] == "BUY_STOP"
    assert candidate["suggested_order_price"] == 50.1
    assert "BUY STOP" in candidate["execution_note"]
    assert isinstance(rec["checklist"][0]["gate_name"], str)
    assert isinstance(rec["education"]["what_would_make_valid"], list)


def test_screener_currency_comes_from_metadata(monkeypatch):
    _disable_social_warmup(monkeypatch)
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
    res = client.post("/api/screener/run", json={"universe": "mega_all", "top": 20})
    assert res.status_code == 200
    candidate = res.json()["candidates"][0]
    assert candidate["currency"] == "EUR"


def test_screener_request_currency_filter_overrides_strategy(monkeypatch):
    _disable_social_warmup(monkeypatch)
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
        json={"universe": "mega_all", "top": 20, "currencies": ["EUR"]},
    )
    assert res.status_code == 200
    assert captured["currencies"] == ["EUR"]


def test_screener_invalid_currency_rejected():
    client = TestClient(app)
    res = client.post(
        "/api/screener/run",
        json={"universe": "mega_all", "top": 20, "currencies": ["JPY"]},
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
            social_warmup_job_id=None,
        )

    monkeypatch.setattr(screener_service.ScreenerService, "run_screener", fake_run)

    client = TestClient(app)
    launch_res = client.post("/api/screener/run", json={"universe": "mega_all", "top": 20})
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
