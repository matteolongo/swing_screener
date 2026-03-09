from fastapi.testclient import TestClient

from api.main import app


def test_strategy_validation_endpoint_returns_read_only_summary():
    client = TestClient(app)

    res = client.get("/api/strategy/validation")

    assert res.status_code == 200
    payload = res.json()
    assert payload["is_valid"] is True
    assert isinstance(payload["warnings"], list)
    assert "safety_score" in payload
    assert "safety_level" in payload
    assert payload["danger_count"] == 0
