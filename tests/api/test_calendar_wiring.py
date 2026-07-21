from __future__ import annotations

import json

from fastapi.testclient import TestClient

from api.main import app


def test_calendar_resolves_sql_positions_repository(tmp_path, monkeypatch):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    orders_path.write_text(json.dumps({"orders": [], "asof": "2026-07-15"}))
    positions_path.write_text(json.dumps({"positions": [], "asof": "2026-07-15"}))
    import api.dependencies as dependencies
    import api.routers.calendar as calendar_router

    monkeypatch.setattr(dependencies, "_orders_path", orders_path)
    monkeypatch.setattr(dependencies, "_positions_path", positions_path)
    monkeypatch.setattr(calendar_router, "DATA_DIR", tmp_path)
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)

    response = TestClient(app).get("/api/calendar/events")

    assert response.status_code == 200
    assert response.json()["events"] == []
