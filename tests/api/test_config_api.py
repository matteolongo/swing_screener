from fastapi.testclient import TestClient

from api.main import app


def test_config_reset_route_removed():
    client = TestClient(app)
    response = client.post("/api/config/reset")
    assert response.status_code == 404
