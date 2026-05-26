from __future__ import annotations
import json
from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

_FAKE_REPORT_PAYLOAD = {
    "report_id": "r-test", "event_summary": "Steel tariff.", "themes": [],
    "causal_chains": [], "beneficiaries": [], "losers": [], "hidden_opportunities": [],
    "non_actionable_notes": [], "generated_at": "2026-05-24T10:00:00Z",
}

_FAKE_OPPORTUNITY = {
    "ticker": "STLD", "state": "CATALYST_ACTIVE", "catalyst_strength": 8.0,
    "thesis": "Domestic steel prices rise.", "key_risks": [], "sources": [], "report_id": "r-test",
    "generated_at": "2026-05-24T10:00:00Z",
}


def test_manual_generation_succeeds(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    from swing_screener.intelligence.catalysts.models import CatalystReport
    fake_report = CatalystReport.model_validate(_FAKE_REPORT_PAYLOAD)
    with patch("api.routers.catalysts.CatalystReportGenerator") as MockGen:
        instance = MagicMock()
        instance.generate_from_url.return_value = fake_report
        MockGen.return_value = instance
        response = client.post("/api/catalysts/manual", json={"url": "https://reuters.com/1"})
    assert response.status_code == 200
    data = response.json()
    assert data["report_id"] == "r-test"


def test_manual_generation_returns_503_without_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post("/api/catalysts/manual", json={"url": "https://reuters.com/1"})
    assert response.status_code == 503


def test_daily_scan_returns_503_without_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post("/api/catalysts/daily-scan")
    assert response.status_code == 503


def test_latest_returns_404_when_no_report(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    response = client.get("/api/catalysts/latest")
    assert response.status_code == 404


def test_latest_returns_cached_report(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    from swing_screener.intelligence.catalysts.store import CatalystStore
    from swing_screener.intelligence.catalysts.models import CatalystReport
    store = CatalystStore()
    store.save_report(CatalystReport.model_validate(_FAKE_REPORT_PAYLOAD))
    response = client.get("/api/catalysts/latest")
    assert response.status_code == 200
    assert response.json()["report_id"] == "r-test"


def test_symbol_endpoint_returns_404_when_no_opportunity(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    response = client.get("/api/catalysts/symbol/AAPL")
    assert response.status_code == 404


def test_symbol_endpoint_returns_opportunity(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    from swing_screener.intelligence.catalysts.store import CatalystStore
    from swing_screener.intelligence.catalysts.models import CatalystOpportunity
    store = CatalystStore()
    from datetime import datetime, timezone
    store.save_symbol_index(datetime.now(timezone.utc).date(), [CatalystOpportunity.model_validate(_FAKE_OPPORTUNITY)])
    response = client.get("/api/catalysts/symbol/STLD")
    assert response.status_code == 200
    assert response.json()["ticker"] == "STLD"


def test_existing_intelligence_endpoints_unaffected(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    response = client.get("/api/intelligence/AAPL/latest")
    assert response.status_code == 404  # no cache, but endpoint exists
