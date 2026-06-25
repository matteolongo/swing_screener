from api.services.datasources_service import DatasourcesService
from swing_screener.data.source_health import SourceDescriptor, ProbeResult
from swing_screener.settings import get_settings_manager


def test_probe_canary_present_in_defaults_yaml():
    """Verify probe_canary symbols are present in defaults.yaml (not just fallback)."""
    defaults = get_settings_manager().load_defaults_document()
    pc = defaults.get("low_level", {}).get("data_providers", {}).get("probe_canary", {})
    assert pc.get("us") == "AAPL"
    assert pc.get("eu") == "ASML.AS"


def test_canary_map_reads_defaults():
    """Verify _canary_map() returns expected symbols from config or fallback."""
    svc = DatasourcesService()
    m = svc._canary_map()
    assert m["us"] == "AAPL"
    assert m["eu"] == "ASML.AS"


def test_inventory_includes_market_fundamentals_intelligence():
    svc = DatasourcesService()
    ids = {d.id for d in svc.inventory()}
    assert {"yfinance", "stooq", "alpaca"} <= ids               # market
    assert {"sec_edgar", "yfinance_fundamentals", "finnhub"} <= ids  # fundamentals + enrichment
    # 1 intelligence source: SEC EDGAR only (Company IR RSS dropped, ~0% hit rate).
    intel = [d for d in svc.inventory() if d.domain == "intelligence"]
    assert {d.id for d in intel} == {"sec_edgar_catalysts"}
    assert all(d.probeable for d in intel)
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
