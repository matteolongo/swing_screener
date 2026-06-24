from api.services.datasources_service import DatasourcesService
from swing_screener.data.source_health import SourceDescriptor, ProbeResult


def test_inventory_includes_market_fundamentals_intelligence():
    svc = DatasourcesService()
    ids = {d.id for d in svc.inventory()}
    assert {"yfinance", "stooq", "alpaca"} <= ids               # market
    assert {"sec_edgar", "yfinance_fundamentals", "finnhub"} <= ids  # fundamentals + enrichment
    # the 6 intelligence catalyst sources, listed but not probeable
    intel = [d for d in svc.inventory() if d.domain == "intelligence"]
    assert len(intel) == 6
    assert all(d.probeable is False for d in intel)
    assert all(d.note for d in intel)


def test_probe_one_unknown_id_returns_not_configured():
    svc = DatasourcesService()
    r = svc.probe_one("does_not_exist")
    assert r.status == "not_configured"


def test_probe_one_routes_to_provider(monkeypatch):
    svc = DatasourcesService()
    monkeypatch.setattr(
        "swing_screener.data.providers.yfinance_provider.YfinanceProvider.probe",
        classmethod(lambda cls, canary: ProbeResult(id="yfinance", status="ok", latency_ms=1.0)),
    )
    r = svc.probe_one("yfinance")
    assert r.status == "ok"


def test_probe_all_runs_each_probeable(monkeypatch):
    svc = DatasourcesService()
    calls = []

    def fake_probe_one(source_id):
        calls.append(source_id)
        return ProbeResult(id=source_id, status="ok")

    monkeypatch.setattr(svc, "probe_one", fake_probe_one)
    results = svc.probe_all()
    probeable_ids = {d.id for d in svc.inventory() if d.probeable}
    assert {r.id for r in results} == probeable_ids
