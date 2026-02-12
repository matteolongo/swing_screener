import json
from fastapi.testclient import TestClient

from api.main import app
import swing_screener.strategy.storage as strategy_storage


def _patch_strategy_storage(monkeypatch, tmp_path):
    data_dir = tmp_path / "data"
    monkeypatch.setattr(strategy_storage, "DATA_DIR", data_dir)
    monkeypatch.setattr(strategy_storage, "STRATEGIES_FILE", data_dir / "strategies.json")
    monkeypatch.setattr(strategy_storage, "ACTIVE_STRATEGY_FILE", data_dir / "active_strategy.json")


def _create_strategy_payload(base: dict, *, strategy_id: str, name: str) -> dict:
    payload = {k: v for k, v in base.items() if k not in {"is_default", "created_at", "updated_at"}}
    payload["id"] = strategy_id
    payload["name"] = name
    return payload


def test_strategy_crud_and_active(monkeypatch, tmp_path):
    _patch_strategy_storage(monkeypatch, tmp_path)

    client = TestClient(app)

    res = client.get("/api/strategy")
    assert res.status_code == 200
    strategies = res.json()
    assert strategies
    assert strategies[0]["id"] == "default"

    res = client.get("/api/strategy/active")
    assert res.status_code == 200
    active = res.json()
    assert active["id"] == "default"
    assert active["universe"]["filt"]["currencies"] == ["USD", "EUR"]

    payload = _create_strategy_payload(active, strategy_id="test", name="Test Strategy")
    res = client.post("/api/strategy", json=payload)
    assert res.status_code == 200
    created = res.json()
    assert created["id"] == "test"
    assert created["is_default"] is False

    res = client.post("/api/strategy/active", json={"strategy_id": "test"})
    assert res.status_code == 200
    active = res.json()
    assert active["id"] == "test"

    payload_update = _create_strategy_payload(created, strategy_id="test", name="Updated Strategy")
    res = client.put("/api/strategy/test", json=payload_update)
    assert res.status_code == 200
    updated = res.json()
    assert updated["name"] == "Updated Strategy"

    res = client.delete("/api/strategy/test")
    assert res.status_code == 200

    res = client.get("/api/strategy/active")
    assert res.status_code == 200
    active = res.json()
    assert active["id"] == "default"


def test_strategy_delete_default_forbidden(monkeypatch, tmp_path):
    _patch_strategy_storage(monkeypatch, tmp_path)

    client = TestClient(app)
    res = client.delete("/api/strategy/default")
    assert res.status_code == 400


def test_strategy_create_default_id_forbidden(monkeypatch, tmp_path):
    _patch_strategy_storage(monkeypatch, tmp_path)

    client = TestClient(app)
    active = client.get("/api/strategy/active").json()
    payload = _create_strategy_payload(active, strategy_id="default", name="Default")

    res = client.post("/api/strategy", json=payload)
    assert res.status_code == 400


def test_strategy_rejects_invalid_currency(monkeypatch, tmp_path):
    _patch_strategy_storage(monkeypatch, tmp_path)

    client = TestClient(app)
    active = client.get("/api/strategy/active").json()
    payload = _create_strategy_payload(active, strategy_id="bad-currency", name="Bad Currency")
    payload["universe"]["filt"]["currencies"] = ["JPY"]

    res = client.post("/api/strategy", json=payload)
    assert res.status_code == 422


def test_strategy_backfills_missing_currency_field(monkeypatch, tmp_path):
    _patch_strategy_storage(monkeypatch, tmp_path)
    strategy_storage.DATA_DIR.mkdir(parents=True, exist_ok=True)

    legacy = strategy_storage._default_strategy_payload()  # noqa: SLF001
    legacy["universe"]["filt"].pop("currencies", None)
    strategy_storage.STRATEGIES_FILE.write_text(json.dumps([legacy]), encoding="utf-8")
    strategy_storage.ACTIVE_STRATEGY_FILE.write_text(json.dumps({"id": "default"}), encoding="utf-8")

    client = TestClient(app)
    active = client.get("/api/strategy/active").json()
    assert active["universe"]["filt"]["currencies"] == ["USD", "EUR"]
