from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app


client = TestClient(app)


def test_strategic_review_endpoint_returns_advisory_overlay(monkeypatch):
    from api.routers import intelligence as router
    from swing_screener.intelligence.strategic.models import (
        StrategicAction,
        StrategicIntelligenceReport,
        StrategicPrediction,
        StrategicSituation,
    )

    class StubStrategicReviewService:
        def review(self, request):
            assert request.ticker == "ASML"
            assert request.refresh_sources is True
            return StrategicIntelligenceReport(
                generated_at="2026-07-04T12:00:00Z",
                external_source_count=1,
                situations=[
                    StrategicSituation(
                        title="Policy-sensitive AI capex",
                        stage="active",
                        why_now=["Export policy news affects technical follow-through."],
                        mechanisms=["Policy risk can reduce multiple tolerance."],
                        affected_symbols=["ASML"],
                        predictions=[
                            StrategicPrediction(
                                direction="mixed",
                                horizon_days=7,
                                thesis="Demand remains constructive, but policy risk can interrupt follow-through.",
                                confidence="medium",
                                invalidation="Invalidate if refreshed evidence no longer shows policy pressure.",
                            )
                        ],
                        actions=[
                            StrategicAction(
                                action_type="REVIEW_CONTEXT",
                                title="Review exposed symbol",
                                rationale="Use the overlay to reinterpret the current analysis.",
                                symbols=["ASML"],
                            )
                        ],
                    )
                ],
                memo="Strategic overlay built from app context only for ASML.",
            )

    monkeypatch.setattr(router, "_get_strategic_review_service", lambda: StubStrategicReviewService())

    response = client.post(
        "/api/intelligence/strategic-review",
        json={
            "ticker": "asml",
            "topic": "Policy-sensitive AI capex",
            "refresh_sources": True,
            "risk_mode": "defensive",
            "horizon_days": 7,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["input_policy"] == "app_context_only"
    assert data["external_source_count"] == 1
    assert data["situations"][0]["affected_symbols"] == ["ASML"]
    assert data["situations"][0]["actions"][0]["action_type"] == "REVIEW_CONTEXT"


def test_strategic_review_failure_is_logged_and_masked(monkeypatch, caplog):
    from api.routers import intelligence as router

    class FailingStrategicReviewService:
        def review(self, request):
            raise RuntimeError("https://provider.example/?token=secret exploded")

    monkeypatch.setattr(router, "_get_strategic_review_service", lambda: FailingStrategicReviewService())

    with caplog.at_level("ERROR", logger="api.routers.intelligence"):
        response = client.post("/api/intelligence/strategic-review", json={"ticker": "ASML"})

    assert response.status_code == 500
    detail = response.json()["detail"]
    assert "secret" not in detail
    error_id = detail.rsplit(" ", 1)[-1].rstrip(".")
    records = [r for r in caplog.records if error_id in r.getMessage()]
    assert records and records[0].exc_info is not None
