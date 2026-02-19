from __future__ import annotations

from fastapi.testclient import TestClient

import swing_screener.strategy.storage as strategy_storage
from api.main import app


def _patch_strategy_storage(monkeypatch, tmp_path):
    data_dir = tmp_path / "data"
    monkeypatch.setattr(strategy_storage, "DATA_DIR", data_dir)
    monkeypatch.setattr(strategy_storage, "STRATEGIES_FILE", data_dir / "strategies.json")
    monkeypatch.setattr(strategy_storage, "ACTIVE_STRATEGY_FILE", data_dir / "active_strategy.json")


def _to_update_payload(strategy: dict) -> dict:
    return {
        key: value
        for key, value in strategy.items()
        if key not in {"id", "is_default", "created_at", "updated_at"}
    }


def test_validate_strategy_safe(monkeypatch, tmp_path):
    _patch_strategy_storage(monkeypatch, tmp_path)
    client = TestClient(app)

    active = client.get("/api/strategy/active").json()
    payload = _to_update_payload(active)
    payload["signals"]["breakout_lookback"] = 50
    payload["signals"]["pullback_ma"] = 20
    payload["risk"]["min_rr"] = 2.5
    payload["risk"]["risk_pct"] = 0.01
    payload["universe"]["filt"]["max_atr_pct"] = 15
    payload["manage"]["max_holding_days"] = 20

    res = client.post("/api/strategy/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    assert data["warnings"] == []
    assert data["safety_score"] == 100
    assert data["safety_level"] == "beginner-safe"
    assert data["total_warnings"] == 0
    assert data["danger_count"] == 0


def test_validate_strategy_dangerous(monkeypatch, tmp_path):
    _patch_strategy_storage(monkeypatch, tmp_path)
    client = TestClient(app)

    active = client.get("/api/strategy/active").json()
    payload = _to_update_payload(active)
    payload["signals"]["breakout_lookback"] = 10
    payload["signals"]["pullback_ma"] = 5
    payload["risk"]["min_rr"] = 1.2
    payload["risk"]["risk_pct"] = 0.04
    payload["universe"]["filt"]["max_atr_pct"] = 30
    payload["manage"]["max_holding_days"] = 3

    res = client.post("/api/strategy/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is False
    assert data["total_warnings"] == 6
    assert data["danger_count"] == 4
    assert data["warning_count"] == 2
    assert data["info_count"] == 0
    assert data["safety_level"] == "expert-only"


def test_create_update_dangerous_strategy_still_allowed(monkeypatch, tmp_path):
    _patch_strategy_storage(monkeypatch, tmp_path)
    client = TestClient(app)

    active = client.get("/api/strategy/active").json()
    create_payload = _to_update_payload(active)
    create_payload["id"] = "danger"
    create_payload["name"] = "Danger Strategy"
    create_payload["signals"]["breakout_lookback"] = 10
    create_payload["risk"]["risk_pct"] = 0.04
    create_payload["risk"]["min_rr"] = 1.2
    create_payload["universe"]["filt"]["max_atr_pct"] = 30

    create_res = client.post("/api/strategy", json=create_payload)
    assert create_res.status_code == 200
    assert create_res.json()["id"] == "danger"

    update_payload = _to_update_payload(create_res.json())
    update_payload["name"] = "Danger Strategy v2"
    update_payload["manage"]["max_holding_days"] = 3
    update_res = client.put("/api/strategy/danger", json=update_payload)
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Danger Strategy v2"
