from fastapi.testclient import TestClient

from api.main import app
import swing_screener.data.universe as universe_data


client = TestClient(app)


def test_list_universes_endpoint_returns_enriched_catalog():
    response = client.get("/api/universes")
    assert response.status_code == 200
    payload = response.json()
    assert "universes" in payload
    amx = next(item for item in payload["universes"] if item["id"] == "amsterdam_amx")
    assert amx["member_count"] == 25
    assert amx["freshness_status"] in {"fresh", "review_due", "stale", "unknown"}
    assert amx["source_adapter"] == "euronext_aex_family_review"


def test_get_universe_detail_endpoint_returns_constituents_and_rules():
    response = client.get("/api/universes/amsterdam_amx")
    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == "amsterdam_amx"
    assert payload["rules"]["exchange_mics"] == ["XAMS", "XPAR"]
    assert any(item["symbol"] == "AF.PA" for item in payload["constituents"])


def test_refresh_manual_universe_returns_preview_without_changes():
    response = client.post("/api/universes/broad_market_stocks/refresh", json={"apply": False})
    assert response.status_code == 200
    payload = response.json()
    assert payload["changed"] is False
    assert payload["applied"] is False
    assert payload["notes"]


def test_update_universe_benchmark_persists_snapshot(monkeypatch):
    snapshot = {
        "id": "broad_market_stocks",
        "benchmark": "SPY",
        "constituents": [{"symbol": "AAPL"}],
        "rules": {},
        "source_adapter": "manual_snapshot",
        "source_documents": [],
        "last_reviewed_at": "2026-04-12",
        "source_asof": "2026-04-12",
        "stale_after_days": 180,
        "kind": "curated",
    }
    writes: list[dict] = []

    monkeypatch.setattr(universe_data, "_load_registry_manifest", lambda: [{"id": "broad_market_stocks", "benchmark": "SPY"}])
    monkeypatch.setattr(universe_data, "_load_snapshot", lambda universe_id: snapshot)
    monkeypatch.setattr(universe_data, "_write_snapshot", lambda universe_id, payload: writes.append(payload))

    response = client.post("/api/universes/broad_market_stocks/benchmark", json={"benchmark": "VGK"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["benchmark"] == "VGK"
    assert writes and writes[0]["benchmark"] == "VGK"
