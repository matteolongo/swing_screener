from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

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
    assert {warning["event_type"] for warning in response.json()["warnings"]} == {"economic", "ipo"}


@pytest.mark.parametrize("query, expected", [
    ("", None),
    ("?candidate_tickers=", set()),
    ("?candidate_tickers=msft,AAPL,msft", {"AAPL", "MSFT"}),
    ("?candidate_tickers=bhartiartl.ns", {"BHARTIARTL.NS"}),
    (
        "?candidate_tickers=" + ",".join(f"SYMBOL{index:010d}" for index in range(200)),
        {f"SYMBOL{index:010d}" for index in range(200)},
    ),
])
def test_calendar_accepts_explicit_current_candidates(query, expected):
    from api.models.calendar import CalendarEventsResponse
    from api.routers.calendar import get_calendar_service

    service = MagicMock()
    service.get_events.return_value = CalendarEventsResponse(events=[], days_ahead=60)
    app.dependency_overrides[get_calendar_service] = lambda: service
    try:
        response = TestClient(app).get(f"/api/calendar/events{query}")
    finally:
        app.dependency_overrides.pop(get_calendar_service, None)
    assert response.status_code == 200
    service.get_events.assert_called_once_with(days_ahead=60, candidate_tickers=expected)


@pytest.mark.parametrize("tickers", ["AAPL,,MSFT", "AAPL/secret", "A" * 17, "AAPL, MSFT"])
def test_calendar_rejects_invalid_candidate_tickers(tickers):
    from api.routers.calendar import get_calendar_service

    service = MagicMock()
    app.dependency_overrides[get_calendar_service] = lambda: service
    try:
        response = TestClient(app).get("/api/calendar/events", params={"candidate_tickers": tickers})
    finally:
        app.dependency_overrides.pop(get_calendar_service, None)
    assert response.status_code == 422
    service.get_events.assert_not_called()
