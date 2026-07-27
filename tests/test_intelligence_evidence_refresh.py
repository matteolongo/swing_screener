from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app
from swing_screener.intelligence.evidence.models import SourceEvidence


def _item() -> SourceEvidence:
    return SourceEvidence(
        title="Public filing",
        url="https://www.sec.gov/example",
        publisher="SEC EDGAR",
        published_at="2026-07-28",
        quote_or_summary="A public filing was published.",
        relevance="Material company update.",
    )


def test_refresh_evidence_returns_sanitized_per_collector_manifest_without_analysis():
    def collect(ticker, *, refresh_sources, attempt_callback):
        assert ticker == "AAPL"
        assert refresh_sources is True
        attempt_callback("sec_edgar_catalysts", "fresh", 1)
        attempt_callback("tavily", "failed", 0)
        return [_item()]

    with (
        patch("api.routers.intelligence.collect_evidence", side_effect=collect),
        patch("api.routers.intelligence._get_analyzer") as analyzer,
    ):
        response = TestClient(app).post("/api/intelligence/aapl/evidence/refresh")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ticker"] == "AAPL"
    assert payload["status"] == "partial"
    assert payload["sources"] == [
        {
            "source": "evidence",
            "provider": "sec_edgar_catalysts",
            "status": "fresh",
            "item_count": 1,
            "as_of": payload["refreshed_at"],
            "message": None,
        },
        {
            "source": "evidence",
            "provider": "tavily",
            "status": "failed",
            "item_count": 0,
            "as_of": payload["refreshed_at"],
            "message": "Evidence provider failed.",
        },
    ]
    assert "secret" not in response.text.lower()
    analyzer.assert_not_called()


def test_refresh_evidence_rejects_invalid_ticker_before_calling_collectors():
    with patch("api.routers.intelligence.collect_evidence") as collect:
        response = TestClient(app).post("/api/intelligence/%20%20/evidence/refresh")

    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid ticker."
    collect.assert_not_called()
