from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)

_INTEL_PAYLOAD = {
    "action": "BUY_NOW", "conviction": "high",
    "catalyst_urgency": "medium",
    "summary_line": "Strong setup.",
    "narrative": "## Why\nText.",
    "upcoming_events": [],
    "position_signal": None,
    "sources": [],
}


def _write_cache(tmp_path: Path, ticker: str, for_date: date) -> None:
    cache_dir = tmp_path / "intelligence"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"sweep_{for_date.isoformat()}.json"
    data = {ticker.upper(): {**_INTEL_PAYLOAD, "symbol": ticker.upper(), "generated_at": "2026-05-24T10:00:00Z"}}
    cache_file.write_text(json.dumps(data))


def test_latest_returns_404_when_no_cache(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    (tmp_path / "intelligence").mkdir(parents=True, exist_ok=True)
    response = client.get("/api/intelligence/AAPL/latest")
    assert response.status_code == 404


def test_latest_returns_cached_entry(tmp_path, monkeypatch):
    from datetime import datetime, timezone
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    today = datetime.now(timezone.utc).date()
    _write_cache(tmp_path, "AAPL", today)
    response = client.get("/api/intelligence/AAPL/latest")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert data["action"] == "BUY_NOW"


def _make_sweep_dep_overrides(app, monkeypatch, tmp_path):
    """Install dependency overrides for sweep's three new Depends and return teardown fn."""
    from unittest.mock import MagicMock
    from api.dependencies import get_positions_repo, get_fundamentals_service, get_portfolio_service

    mock_positions_repo = MagicMock()
    mock_positions_repo.list_positions.return_value = ([], None)

    mock_fundamentals = MagicMock()
    mock_portfolio = MagicMock()
    # fetch_recent_ohlcv raises so technicals enrichment is skipped gracefully
    mock_portfolio.fetch_recent_ohlcv.side_effect = RuntimeError("no ohlcv in test")
    mock_portfolio.get_earnings_proximity.return_value = MagicMock(days_until=None, next_earnings_date=None)

    app.dependency_overrides[get_positions_repo] = lambda: mock_positions_repo
    app.dependency_overrides[get_fundamentals_service] = lambda: mock_fundamentals
    app.dependency_overrides[get_portfolio_service] = lambda: mock_portfolio

    return mock_positions_repo, mock_fundamentals, mock_portfolio


def test_sweep_returns_analyzed_and_failed(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    from swing_screener.intelligence.models import SymbolIntelligence
    from api.main import app as _app
    ok_result = SymbolIntelligence(
        symbol="AAPL", generated_at="2026-05-24T10:00:00Z",
        action="BUY_NOW", conviction="high", catalyst_urgency="none",
        summary_line="OK", narrative="Text.", sources=[],
    )

    _make_sweep_dep_overrides(_app, monkeypatch, tmp_path)
    try:
        def fake_analyze(ticker, req, **kwargs):
            if ticker == "FAIL":
                raise RuntimeError("API error")
            return ok_result

        with patch("api.routers.intelligence.SymbolAnalyzer") as MockAnalyzer:
            instance = MagicMock()
            instance.analyze.side_effect = fake_analyze
            MockAnalyzer.return_value = instance

            payload = {
                "symbols": [
                    {"ticker": "AAPL", "request": {"close": 180.0, "signal": "breakout"}},
                    {"ticker": "FAIL", "request": {"close": 10.0, "signal": "pullback"}},
                ]
            }
            response = client.post("/api/intelligence/sweep", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "AAPL" in data["analyzed"]
        assert any(f["ticker"] == "FAIL" for f in data["failed"])
    finally:
        from api.dependencies import get_positions_repo, get_fundamentals_service, get_portfolio_service
        _app.dependency_overrides.pop(get_positions_repo, None)
        _app.dependency_overrides.pop(get_fundamentals_service, None)
        _app.dependency_overrides.pop(get_portfolio_service, None)


def test_sweep_returns_503_without_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    payload = {"symbols": [{"ticker": "AAPL", "request": {"close": 100.0, "signal": "breakout"}}]}
    response = client.post("/api/intelligence/sweep", json=payload)
    assert response.status_code == 503


def test_analyze_returns_cache_unless_force(tmp_path, monkeypatch):
    from api.routers import intelligence as r
    from swing_screener.intelligence.models import SymbolIntelligence

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))

    cached = SymbolIntelligence(
        symbol="AAA",
        generated_at="2026-06-25T00:00:00+00:00",
        action="WATCH",
        conviction="low",
        catalyst_urgency="none",
        summary_line="s",
        narrative="n",
    )
    monkeypatch.setattr(r, "read_from_cache", lambda t, *a, **k: cached)

    def _fake_get_analyzer():
        class _A:
            def analyze(self, *a, **k):
                raise AssertionError("analyzer was called — should have returned cache")
        return _A()

    monkeypatch.setattr(r, "_get_analyzer", _fake_get_analyzer)

    resp = client.post("/api/intelligence/AAA", json={"close": 1.0, "signal": "x"})
    assert resp.status_code == 200
    assert resp.json()["symbol"] == "AAA"


def test_sweep_enriches_uncached_symbol(tmp_path, monkeypatch):
    """enrich_intelligence_request called once per uncached symbol in sweep."""
    from api.routers import intelligence as r
    from api.main import app as _app
    from swing_screener.intelligence.models import SymbolIntelligence

    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    ok_result = SymbolIntelligence(
        symbol="TSLA", generated_at="2026-06-25T10:00:00Z",
        action="BUY_NOW", conviction="high", catalyst_urgency="none",
        summary_line="OK", narrative="Text.", sources=[],
    )

    _make_sweep_dep_overrides(_app, monkeypatch, tmp_path)
    try:
        enrich_calls: list[str] = []

        def fake_enrich(ticker, req, **kwargs):
            enrich_calls.append(ticker)
            return req

        monkeypatch.setattr(r, "enrich_intelligence_request", fake_enrich)
        # enrich_with_technicals: just pass through
        monkeypatch.setattr(r, "enrich_with_technicals", lambda t, req, ohlcv: req)

        def fake_analyze(ticker, req, **kwargs):
            return ok_result

        monkeypatch.setattr(r, "_get_analyzer", lambda: MagicMock(analyze=fake_analyze))
        # no cache → enrich must be called
        monkeypatch.setattr(r, "read_from_cache", lambda t: None)

        payload = {"symbols": [{"ticker": "TSLA", "request": {"close": 200.0, "signal": "breakout"}}]}
        response = client.post("/api/intelligence/sweep", json=payload)

        assert response.status_code == 200
        assert response.json()["analyzed"] == ["TSLA"]
        assert enrich_calls == ["TSLA"], f"expected enrich called once for TSLA, got {enrich_calls}"
    finally:
        from api.dependencies import get_positions_repo, get_fundamentals_service, get_portfolio_service
        _app.dependency_overrides.pop(get_positions_repo, None)
        _app.dependency_overrides.pop(get_fundamentals_service, None)
        _app.dependency_overrides.pop(get_portfolio_service, None)


def test_analyze_returns_503_when_kill_switch_off(monkeypatch):
    """When config.llm.analyzer_enabled=False the endpoint must return 503."""
    from unittest.mock import MagicMock
    import api.routers.intelligence as r

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    fake_mgr = MagicMock()
    fake_mgr.load_intelligence_document.return_value = {
        "config": {"llm": {"analyzer_enabled": False}}
    }
    monkeypatch.setattr(r, "get_settings_manager", lambda: fake_mgr)

    resp = client.post("/api/intelligence/AAA", json={"close": 1.0, "signal": "x"})
    assert resp.status_code == 503
    assert "disabled" in resp.json()["detail"].lower()
