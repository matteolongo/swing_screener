from fastapi import FastAPI
from fastapi.testclient import TestClient

from swing_screener.errors import NotFoundError, ValidationError, UpstreamError
from api.main import register_domain_error_handler


def _app_raising(exc):
    app = FastAPI()
    register_domain_error_handler(app)

    @app.get("/boom")
    def boom():
        raise exc

    return TestClient(app, raise_server_exceptions=False)


def test_not_found_maps_to_404():
    r = _app_raising(NotFoundError("Position not found: P1")).get("/boom")
    assert r.status_code == 404
    assert r.json() == {"detail": "Position not found: P1"}


def test_validation_maps_to_400():
    r = _app_raising(ValidationError("bad")).get("/boom")
    assert r.status_code == 400
    assert r.json() == {"detail": "bad"}


def test_upstream_maps_to_502():
    r = _app_raising(UpstreamError("provider down")).get("/boom")
    assert r.status_code == 502
    assert r.json() == {"detail": "provider down"}
