from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.main import app
from swing_screener.intelligence import tracing


@pytest.fixture(autouse=True)
def _isolate(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    yield


@pytest.fixture()
def client():
    return TestClient(app)


def _seed_trace(run_id: str, ticker: str) -> None:
    rec = tracing.TraceRecorder(ticker, run_id=run_id)
    with rec.step("resolve_context"):
        pass
    rec.finish()
    tracing.write_run_trace(rec.trace)


def test_get_run_trace_returns_trace(client):
    _seed_trace("run-1", "AAPL")
    resp = client.get("/api/intelligence/runs/run-1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["run_id"] == "run-1"
    assert body["ticker"] == "AAPL"
    assert body["steps"][0]["name"] == "resolve_context"


def test_get_run_trace_404_on_miss(client):
    resp = client.get("/api/intelligence/runs/nope")
    assert resp.status_code == 404


def test_list_ticker_runs(client):
    _seed_trace("run-1", "AAPL")
    _seed_trace("run-2", "AAPL")
    resp = client.get("/api/intelligence/AAPL/runs")
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert {e["run_id"] for e in entries} == {"run-1", "run-2"}


def test_list_ticker_runs_empty(client):
    resp = client.get("/api/intelligence/ZZZZ/runs")
    assert resp.status_code == 200
    assert resp.json()["entries"] == []
