from types import SimpleNamespace

from fastapi.testclient import TestClient

from api.main import app
import api.services.intelligence_service as intelligence_service


class _FakeConfigService:
    def __init__(self):
        self._config = {
            "enabled": True,
            "providers": ["yahoo_finance"],
            "universe_scope": "screener_universe",
            "market_context_symbols": ["SPY"],
            "llm": {
                "enabled": False,
                "provider": "mock",
                "model": "mistral:7b-instruct",
                "base_url": "http://localhost:11434",
                "enable_cache": True,
                "enable_audit": True,
                "cache_path": "data/intelligence/llm_cache.json",
                "audit_path": "data/intelligence/llm_audit",
                "max_concurrency": 4,
            },
            "catalyst": {
                "lookback_hours": 72,
                "recency_half_life_hours": 36,
                "false_catalyst_return_z": 1.5,
                "min_price_reaction_atr": 0.8,
                "require_price_confirmation": True,
            },
            "theme": {
                "enabled": True,
                "min_cluster_size": 3,
                "min_peer_confirmation": 2,
                "curated_peer_map_path": "data/intelligence/peer_map.yaml",
            },
            "opportunity": {
                "technical_weight": 0.55,
                "catalyst_weight": 0.45,
                "max_daily_opportunities": 8,
                "min_opportunity_score": 0.55,
            },
        }

    def get_config(self):
        from api.models.intelligence_config import IntelligenceConfigModel

        return IntelligenceConfigModel.model_validate(self._config)

    def resolve_symbol_scope(self, *, symbols, symbol_set_id):
        if symbols:
            return symbols
        if symbol_set_id == "set-1":
            return ["AAPL", "MSFT"]
        raise ValueError("unknown symbol set")


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


def test_intelligence_run_rejects_unsupported_provider():
    client = TestClient(app)
    res = client.post(
        "/api/intelligence/run",
        json={"symbols": ["AAPL"], "providers": ["unsupported_provider"]},
    )
    assert res.status_code == 422
    assert "unsupported provider" in res.text.lower()


def test_intelligence_run_rejects_scope_when_both_provided():
    client = TestClient(app)
    res = client.post(
        "/api/intelligence/run",
        json={"symbols": ["AAPL"], "symbol_set_id": "set-1"},
    )
    assert res.status_code == 422
    assert "exactly one" in res.text.lower()


def test_intelligence_run_accepts_symbol_set_scope(monkeypatch):
    captured = {}
    fake_job = SimpleNamespace(
        job_id="intel-job-set",
        status="queued",
        total_symbols=2,
        completed_symbols=0,
        asof_date=None,
        opportunities_count=0,
        error=None,
        created_at="2026-02-15T10:00:00",
        updated_at="2026-02-15T10:00:00",
    )

    def _start_job(**kwargs):
        captured["symbols"] = kwargs.get("symbols")
        return "intel-job-set"

    fake_manager = SimpleNamespace(
        start_job=_start_job,
        get_job=lambda _job_id: fake_job,
    )
    monkeypatch.setattr(intelligence_service, "get_intelligence_run_manager", lambda: fake_manager)

    client = TestClient(app)
    create_res = client.post(
        "/api/intelligence/symbol-sets",
        json={"name": "Run Scope", "symbols": ["AAPL", "MSFT"]},
    )
    assert create_res.status_code == 200
    set_id = create_res.json()["id"]

    run_res = client.post("/api/intelligence/run", json={"symbol_set_id": set_id})
    assert run_res.status_code == 200
    assert captured["symbols"] == ["AAPL", "MSFT"]


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


def test_intelligence_status_includes_llm_warnings(monkeypatch):
    fake_job = SimpleNamespace(
        job_id="intel-job-llm",
        status="completed",
        total_symbols=3,
        completed_symbols=3,
        asof_date="2026-02-24",
        opportunities_count=2,
        llm_warnings_count=1,
        llm_warning_sample="Invalid symbol format: KEYSIGHT",
        analysis_summary="Scanned 3 symbols and found 2 opportunities.",
        error=None,
        created_at="2026-02-24T23:00:00",
        updated_at="2026-02-24T23:00:05",
    )
    fake_manager = SimpleNamespace(
        start_job=lambda **kwargs: None,
        get_job=lambda _job_id: fake_job,
    )
    monkeypatch.setattr(intelligence_service, "get_intelligence_run_manager", lambda: fake_manager)

    client = TestClient(app)
    res = client.get("/api/intelligence/run/intel-job-llm")
    assert res.status_code == 200
    payload = res.json()
    assert payload["llm_warnings_count"] == 1
    assert "KEYSIGHT" in payload["llm_warning_sample"]
    assert "Scanned 3 symbols" in payload["analysis_summary"]


def test_intelligence_opportunities_returns_payload(monkeypatch):
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

    service = intelligence_service.IntelligenceService(
        strategy_repo=SimpleNamespace(get_active_strategy=lambda: {}),
        config_service=_FakeConfigService(),
    )
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

    service = intelligence_service.IntelligenceService(
        strategy_repo=SimpleNamespace(get_active_strategy=lambda: {}),
        config_service=_FakeConfigService(),
    )
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


def test_intelligence_config_roundtrip():
    client = TestClient(app)
    get_res = client.get("/api/intelligence/config")
    assert get_res.status_code == 200
    payload = get_res.json()

    payload["llm"]["provider"] = "mock"
    payload["llm"]["system_prompt"] = "You are a strict event classifier."
    payload["llm"]["user_prompt_template"] = (
        "Classify this headline.\nHeadline: \"{{headline}}\"\n{{taxonomy}}\n{{instructions}}"
    )
    put_res = client.put("/api/intelligence/config", json=payload)
    assert put_res.status_code == 200

    get_res_2 = client.get("/api/intelligence/config")
    assert get_res_2.status_code == 200
    assert get_res_2.json()["llm"]["provider"] == "mock"
    assert get_res_2.json()["llm"]["system_prompt"] == "You are a strict event classifier."
    assert "{{headline}}" in get_res_2.json()["llm"]["user_prompt_template"]


def test_intelligence_symbol_set_crud():
    client = TestClient(app)
    create_res = client.post(
        "/api/intelligence/symbol-sets",
        json={"name": "Tech Leaders", "symbols": ["aapl", "msft", "AAPL"]},
    )
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["symbols"] == ["AAPL", "MSFT"]

    set_id = created["id"]
    update_res = client.put(
        f"/api/intelligence/symbol-sets/{set_id}",
        json={"name": "Tech Core", "symbols": ["NVDA", "MSFT"]},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Tech Core"

    list_res = client.get("/api/intelligence/symbol-sets")
    assert list_res.status_code == 200
    assert any(item["id"] == set_id for item in list_res.json()["items"])

    delete_res = client.delete(f"/api/intelligence/symbol-sets/{set_id}")
    assert delete_res.status_code == 200
    assert delete_res.json()["deleted"] is True
