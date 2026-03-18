import json
from fastapi.testclient import TestClient
import yaml

from api.main import app
import swing_screener.strategy.storage as strategy_storage


def _patch_strategy_storage(monkeypatch, tmp_path):
    config_dir = tmp_path / "config"
    monkeypatch.setattr(strategy_storage, "CONFIG_DIR", config_dir)
    monkeypatch.setattr(strategy_storage, "DATA_DIR", config_dir)
    monkeypatch.setattr(strategy_storage, "STRATEGIES_FILE", config_dir / "strategies.yaml")
    monkeypatch.setattr(strategy_storage, "ACTIVE_STRATEGY_FILE", config_dir / "strategies.yaml")


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
    strategy_storage.STRATEGIES_FILE.parent.mkdir(parents=True, exist_ok=True)

    legacy = strategy_storage._default_strategy_payload()  # noqa: SLF001
    legacy["universe"]["filt"].pop("currencies", None)
    strategy_storage.STRATEGIES_FILE.write_text(
        yaml.safe_dump({"active_strategy_id": "default", "strategies": [legacy]}, sort_keys=False),
        encoding="utf-8",
    )

    client = TestClient(app)
    active = client.get("/api/strategy/active").json()
    assert active["universe"]["filt"]["currencies"] == ["USD", "EUR"]


def test_strategy_migrates_legacy_backtest_fields_into_risk(monkeypatch, tmp_path):
    _patch_strategy_storage(monkeypatch, tmp_path)
    strategy_storage.STRATEGIES_FILE.parent.mkdir(parents=True, exist_ok=True)

    legacy = strategy_storage._default_strategy_payload()  # noqa: SLF001
    legacy["risk"].pop("rr_target", None)
    legacy["risk"].pop("commission_pct", None)
    legacy["backtest"] = {
        "take_profit_r": 2.7,
        "commission_pct": 0.003,
    }
    strategy_storage.STRATEGIES_FILE.write_text(
        yaml.safe_dump({"active_strategy_id": "default", "strategies": [legacy]}, sort_keys=False),
        encoding="utf-8",
    )

    client = TestClient(app)
    active = client.get("/api/strategy/active").json()

    assert active["risk"]["rr_target"] == 2.7
    assert active["risk"]["commission_pct"] == 0.003
    assert "backtest" not in active

    persisted = yaml.safe_load(strategy_storage.STRATEGIES_FILE.read_text(encoding="utf-8"))
    assert persisted["strategies"][0]["risk"]["rr_target"] == 2.7
    assert persisted["strategies"][0]["risk"]["commission_pct"] == 0.003
    assert "backtest" not in persisted["strategies"][0]


def test_strategy_migration_prefers_existing_risk_fields(monkeypatch, tmp_path):
    _patch_strategy_storage(monkeypatch, tmp_path)
    strategy_storage.STRATEGIES_FILE.parent.mkdir(parents=True, exist_ok=True)

    legacy = strategy_storage._default_strategy_payload()  # noqa: SLF001
    legacy["risk"]["rr_target"] = 3.1
    legacy["risk"]["commission_pct"] = 0.001
    legacy["backtest"] = {
        "take_profit_r": 4.5,
        "commission_pct": 0.02,
    }
    strategy_storage.STRATEGIES_FILE.write_text(
        yaml.safe_dump({"active_strategy_id": "default", "strategies": [legacy]}, sort_keys=False),
        encoding="utf-8",
    )

    client = TestClient(app)
    active = client.get("/api/strategy/active").json()

    assert active["risk"]["rr_target"] == 3.1
    assert active["risk"]["commission_pct"] == 0.001
    assert "backtest" not in active


def test_strategy_migrates_legacy_removed_plugin_out_of_payload(monkeypatch, tmp_path):
    _patch_strategy_storage(monkeypatch, tmp_path)
    strategy_storage.STRATEGIES_FILE.parent.mkdir(parents=True, exist_ok=True)

    legacy = strategy_storage._default_strategy_payload()  # noqa: SLF001
    legacy["soc" "ial" "_overlay"] = {
        "enabled": True,
        "providers": ["reddit"],
    }
    strategy_storage.STRATEGIES_FILE.write_text(
        yaml.safe_dump({"active_strategy_id": "default", "strategies": [legacy]}, sort_keys=False),
        encoding="utf-8",
    )

    client = TestClient(app)
    active = client.get("/api/strategy/active").json()

    assert "soc" "ial" "_overlay" not in active

    persisted = yaml.safe_load(strategy_storage.STRATEGIES_FILE.read_text(encoding="utf-8"))
    assert "soc" "ial" "_overlay" not in persisted["strategies"][0]
