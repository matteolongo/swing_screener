import pandas as pd
from fastapi.testclient import TestClient

from api.main import app
import api.routers.screener as screener_router


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


def test_screener_top_over_100_returns_candidates(monkeypatch):
    ohlcv = _ohlcv_with_spy()

    def fake_fetch_ohlcv(tickers, cfg, use_cache=True, force_refresh=False):
        return ohlcv

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

    monkeypatch.setattr(screener_router, "fetch_ohlcv", fake_fetch_ohlcv)
    monkeypatch.setattr(screener_router, "build_daily_report", fake_build_daily_report)
    monkeypatch.setattr(screener_router, "get_multiple_ticker_info", lambda tickers: {})

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "mega_all", "top": 200})
    assert res.status_code == 200
    data = res.json()
    assert len(data["candidates"]) == 150
    assert data["warnings"] == ["Only 150 candidates found for top 200."]
    assert data["candidates"][0]["last_bar"] == "2024-01-03T00:00:00"


def test_screener_empty_ohlcv_returns_404(monkeypatch):
    def fake_fetch_ohlcv(tickers, cfg, use_cache=True, force_refresh=False):
        return pd.DataFrame()

    monkeypatch.setattr(screener_router, "fetch_ohlcv", fake_fetch_ohlcv)

    client = TestClient(app)
    res = client.post("/api/screener/run", json={"universe": "mega_all", "top": 200})
    assert res.status_code == 404
