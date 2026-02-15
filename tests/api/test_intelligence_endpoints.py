from types import SimpleNamespace

from fastapi.testclient import TestClient

from api.main import app
import api.services.intelligence_service as intelligence_service


def test_intelligence_run_launches_job(monkeypatch):
    fake_job = SimpleNamespace(
        job_id="intel-job-1",
        status="queued",
        total_symbols=3,
        completed_symbols=0,
        asof_date=None,
        opportunities_count=0,
        error=None,
        created_at="2026-02-15T10:00:00",
        updated_at="2026-02-15T10:00:00",
    )
    fake_manager = SimpleNamespace(
        start_job=lambda **kwargs: "intel-job-1",
        get_job=lambda _job_id: fake_job,
    )
    monkeypatch.setattr(intelligence_service, "get_intelligence_run_manager", lambda: fake_manager)

    client = TestClient(app)
    res = client.post(
        "/api/intelligence/run",
        json={"symbols": ["AAPL", "MSFT", "NVDA"], "max_opportunities": 5},
    )
    assert res.status_code == 200
    payload = res.json()
    assert payload["job_id"] == "intel-job-1"
    assert payload["status"] == "queued"
    assert payload["total_symbols"] == 3


def test_intelligence_status_returns_404_when_missing(monkeypatch):
    fake_manager = SimpleNamespace(
        start_job=lambda **kwargs: None,
        get_job=lambda _job_id: None,
    )
    monkeypatch.setattr(intelligence_service, "get_intelligence_run_manager", lambda: fake_manager)

    client = TestClient(app)
    res = client.get("/api/intelligence/run/does-not-exist")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_intelligence_opportunities_returns_payload(monkeypatch, tmp_path):
    class FakeStorage:
        def latest_opportunities_date(self):
            return "2026-02-15"

        def load_opportunities(self, asof_date):
            assert asof_date == "2026-02-15"
            from swing_screener.intelligence.models import Opportunity

            return [
                Opportunity(
                    symbol="AAPL",
                    technical_readiness=0.8,
                    catalyst_strength=0.7,
                    opportunity_score=0.755,
                    state="CATALYST_ACTIVE",
                    explanations=["technical=0.80", "catalyst=0.70", "blend=0.76"],
                )
            ]

    service = intelligence_service.IntelligenceService(strategy_repo=SimpleNamespace(get_active_strategy=lambda: {}))
    monkeypatch.setattr(service, "_storage", FakeStorage())
    app.dependency_overrides = {}
    from api.routers.intelligence import get_intelligence_service as dep

    app.dependency_overrides[dep] = lambda: service
    try:
        client = TestClient(app)
        res = client.get("/api/intelligence/opportunities")
        assert res.status_code == 200
        payload = res.json()
        assert payload["asof_date"] == "2026-02-15"
        assert payload["opportunities"][0]["symbol"] == "AAPL"
    finally:
        app.dependency_overrides.clear()


def test_intelligence_opportunities_filters_by_symbols_query(monkeypatch):
    class FakeStorage:
        def latest_opportunities_date(self):
            return "2026-02-15"

        def load_opportunities(self, asof_date):
            assert asof_date == "2026-02-15"
            from swing_screener.intelligence.models import Opportunity

            return [
                Opportunity(
                    symbol="AAPL",
                    technical_readiness=0.8,
                    catalyst_strength=0.7,
                    opportunity_score=0.755,
                    state="CATALYST_ACTIVE",
                    explanations=["technical=0.80", "catalyst=0.70", "blend=0.76"],
                ),
                Opportunity(
                    symbol="MSFT",
                    technical_readiness=0.79,
                    catalyst_strength=0.66,
                    opportunity_score=0.731,
                    state="WATCH",
                    explanations=["technical=0.79", "catalyst=0.66", "blend=0.73"],
                ),
            ]

    service = intelligence_service.IntelligenceService(strategy_repo=SimpleNamespace(get_active_strategy=lambda: {}))
    monkeypatch.setattr(service, "_storage", FakeStorage())
    app.dependency_overrides = {}
    from api.routers.intelligence import get_intelligence_service as dep

    app.dependency_overrides[dep] = lambda: service
    try:
        client = TestClient(app)
        res = client.get("/api/intelligence/opportunities?asof_date=2026-02-15&symbols=MSFT")
        assert res.status_code == 200
        payload = res.json()
        assert payload["asof_date"] == "2026-02-15"
        assert len(payload["opportunities"]) == 1
        assert payload["opportunities"][0]["symbol"] == "MSFT"
    finally:
        app.dependency_overrides.clear()
