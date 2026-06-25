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


def test_sweep_returns_analyzed_and_failed(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    from swing_screener.intelligence.models import SymbolIntelligence
    ok_result = SymbolIntelligence(
        symbol="AAPL", generated_at="2026-05-24T10:00:00Z",
        action="BUY_NOW", conviction="high", catalyst_urgency="none",
        summary_line="OK", narrative="Text.", sources=[],
    )

    def fake_analyze(ticker, req):
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
