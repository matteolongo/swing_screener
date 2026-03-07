from fastapi.testclient import TestClient

from api.main import app


def test_strategy_read_only_endpoints_expose_yaml_config():
    client = TestClient(app)

    config_res = client.get("/api/strategy/config")
    assert config_res.status_code == 200
    config = config_res.json()
    assert config["name"] == "Default"
    assert config["module"] == "momentum"
    assert "execution_order" in config
    assert any(plugin["id"] == "volume_confirmation" for plugin in config["plugins"])
    volume_plugin = next(plugin for plugin in config["plugins"] if plugin["id"] == "volume_confirmation")
    assert "breakout_signal" in volume_plugin["depends_on"]

    plugins_res = client.get("/api/strategy/plugins")
    assert plugins_res.status_code == 200
    plugins = plugins_res.json()
    assert any(plugin["id"] == "breakout_signal" for plugin in plugins)
    assert any(plugin["id"] == "social_overlay" for plugin in plugins)

    validation_res = client.get("/api/strategy/validation")
    assert validation_res.status_code == 200
    validation = validation_res.json()
    assert validation["is_valid"] is True
    assert "safety_score" in validation


def test_strategy_mutations_are_disabled_in_read_only_mode():
    client = TestClient(app)
    active = client.get("/api/strategy/active").json()
    payload = {
        key: value
        for key, value in active.items()
        if key not in {"is_default", "created_at", "updated_at"}
    }
    payload["id"] = "new-id"

    assert client.post("/api/strategy", json=payload).status_code == 405
    assert client.put("/api/strategy/default", json=payload).status_code == 405
    assert client.delete("/api/strategy/default").status_code == 405
    assert client.post("/api/strategy/active", json={"strategy_id": "default"}).status_code == 405
