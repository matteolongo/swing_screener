from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.request_context import (
    REQUEST_ID_HEADER,
    RequestContextMiddleware,
    RequestIdLogFilter,
    current_request_id,
)


def _client() -> TestClient:
    app = FastAPI()

    @app.get("/echo")
    def echo():
        return {"request_id": current_request_id()}

    app.add_middleware(RequestContextMiddleware)
    return TestClient(app)


def test_generates_request_id_visible_to_handler_and_response():
    response = _client().get("/echo")

    request_id = response.headers[REQUEST_ID_HEADER]
    assert len(request_id) == 32
    assert response.json() == {"request_id": request_id}


def test_reuses_well_formed_inbound_id_and_replaces_malformed_one():
    client = _client()

    assert client.get("/echo", headers={REQUEST_ID_HEADER: "proxy-abc.1"}).headers[REQUEST_ID_HEADER] == "proxy-abc.1"
    replaced = client.get("/echo", headers={REQUEST_ID_HEADER: "bad id\nforged"}).headers[REQUEST_ID_HEADER]
    assert replaced != "bad id\nforged"
    assert len(replaced) == 32


def test_log_filter_defaults_outside_a_request():
    record = logging.LogRecord("x", logging.INFO, __file__, 1, "msg", None, None)

    assert RequestIdLogFilter().filter(record) is True
    assert record.request_id == "-"
    assert current_request_id() is None
