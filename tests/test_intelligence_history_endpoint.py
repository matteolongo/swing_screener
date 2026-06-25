from fastapi.testclient import TestClient

from api.main import app
from swing_screener.intelligence.history import append_history
from swing_screener.intelligence.models import SymbolIntelligence


def _result(summary: str, generated_at: str = "2026-06-25T08:00:00Z") -> SymbolIntelligence:
    return SymbolIntelligence(
        symbol="AAPL", generated_at=generated_at,
        action="MANAGE_ONLY", conviction="medium",
        summary_line=summary, narrative="Text.",
        risk_factors=["watch the gap"],
    )


def test_history_endpoint_returns_entries_newest_first(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    append_history("AAPL", _result("first", "2026-06-24T08:00:00Z"), max_entries=50)
    append_history("AAPL", _result("second", "2026-06-25T08:00:00Z"), max_entries=50)

    client = TestClient(app)
    resp = client.get("/api/intelligence/aapl/history")

    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert [e["summary_line"] for e in entries] == ["second", "first"]
    assert entries[0]["watch_for"] == ["watch the gap"]


def test_history_endpoint_empty_when_no_history(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    client = TestClient(app)
    resp = client.get("/api/intelligence/NOPE/history")
    assert resp.status_code == 200
    assert resp.json() == {"entries": []}
