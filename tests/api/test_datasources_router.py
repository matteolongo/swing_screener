from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_get_inventory():
    resp = client.get("/api/datasources")
    assert resp.status_code == 200
    body = resp.json()
    ids = {s["id"] for s in body["sources"]}
    assert "yfinance" in ids
    assert any(s["domain"] == "intelligence" for s in body["sources"])


def test_get_events_empty_or_list():
    resp = client.get("/api/datasources/events")
    assert resp.status_code == 200
    assert "events" in resp.json()


def test_probe_unknown_id():
    resp = client.post("/api/datasources/nope/probe")
    assert resp.status_code == 200
    assert resp.json()["status"] == "not_configured"
