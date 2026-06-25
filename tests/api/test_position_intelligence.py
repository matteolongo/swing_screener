"""Tests for open-position intelligence endpoints."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.dependencies import get_fundamentals_service, get_portfolio_service


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.pop(get_portfolio_service, None)
    app.dependency_overrides.pop(get_fundamentals_service, None)


@pytest.fixture
def client():
    return TestClient(app)


def _mock_position(ticker: str = "BESI.AS", position_id: str = "pos-1") -> MagicMock:
    p = MagicMock()
    p.position_id = position_id
    p.ticker = ticker
    p.entry_price = 250.0
    p.stop_price = 230.0
    p.current_price = 287.6
    p.r_now = 1.88
    p.days_open = 14
    p.status = "open"
    return p


def _mock_stop_suggestion() -> MagicMock:
    s = MagicMock()
    s.action = "MOVE_STOP_UP"
    s.stop_suggested = 240.0
    s.reason = "Trail: R=1.88"
    return s


def test_open_positions_intelligence_returns_list(client):
    positions_resp = MagicMock()
    positions_resp.positions = [_mock_position()]

    svc = MagicMock()
    svc.list_positions.return_value = positions_resp
    svc.suggest_position_stop.return_value = _mock_stop_suggestion()
    app.dependency_overrides[get_portfolio_service] = lambda: svc

    with patch("api.routers.portfolio.read_from_cache", return_value=None):
        response = client.get("/api/portfolio/positions/open/intelligence")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    item = data[0]
    assert item["ticker"] == "BESI.AS"
    assert item["position_id"] == "pos-1"
    assert item["r_now"] == pytest.approx(1.88)
    assert item["stop_action"] == "MOVE_STOP_UP"
    assert item["intelligence"] is None


def test_open_positions_intelligence_includes_cached_intelligence(client):
    positions_resp = MagicMock()
    positions_resp.positions = [_mock_position()]

    from swing_screener.intelligence.models import (
        SymbolIntelligence,
        PositionSignal,
        PositionSignalAction,
    )
    cached = SymbolIntelligence(
        symbol="BESI.AS",
        generated_at="2026-05-30T03:00:00",
        action="BUY_ON_PULLBACK",
        conviction="medium",
        catalyst_urgency="none",
        summary_line="Setup intact, trail stop.",
        narrative="...",
        upcoming_events=[],
        position_signal=PositionSignal(action=PositionSignalAction.HOLD, reason="Thesis intact."),
        sources=[],
        inputs_used={},
    )

    svc = MagicMock()
    svc.list_positions.return_value = positions_resp
    svc.suggest_position_stop.return_value = _mock_stop_suggestion()
    app.dependency_overrides[get_portfolio_service] = lambda: svc

    with patch("api.routers.portfolio.read_from_cache", return_value=cached):
        response = client.get("/api/portfolio/positions/open/intelligence")

    assert response.status_code == 200
    data = response.json()
    assert data[0]["intelligence"] is not None
    assert data[0]["intelligence"]["position_signal"]["action"] == "HOLD"


def test_open_positions_intelligence_empty_when_no_open_positions(client):
    positions_resp = MagicMock()
    positions_resp.positions = []

    svc = MagicMock()
    svc.list_positions.return_value = positions_resp
    app.dependency_overrides[get_portfolio_service] = lambda: svc

    response = client.get("/api/portfolio/positions/open/intelligence")

    assert response.status_code == 200
    assert response.json() == []


def test_analyze_position_503_without_api_key(client):
    import os
    env_backup = os.environ.pop("OPENAI_API_KEY", None)
    try:
        response = client.post("/api/intelligence/position/pos-1")
        assert response.status_code == 503
    finally:
        if env_backup is not None:
            os.environ["OPENAI_API_KEY"] = env_backup


def test_analyze_position_returns_intelligence(client):
    from swing_screener.intelligence.models import (
        SymbolIntelligence,
        PositionSignal,
        PositionSignalAction,
    )

    pos = _mock_position()
    positions_resp = MagicMock()
    positions_resp.positions = [pos]

    mock_intelligence = SymbolIntelligence(
        symbol="BESI.AS",
        generated_at="2026-05-30T03:00:00",
        action="BUY_ON_PULLBACK",
        conviction="medium",
        catalyst_urgency="none",
        summary_line="Hold, thesis intact.",
        narrative="...",
        upcoming_events=[],
        position_signal=PositionSignal(action=PositionSignalAction.HOLD, reason="Momentum sustained."),
        sources=[],
        inputs_used={},
    )

    def override_portfolio():
        import pandas as pd
        from api.models.portfolio import EarningsProximityResponse
        svc = MagicMock()
        svc.list_positions.return_value = positions_resp
        svc.suggest_position_stop.return_value = _mock_stop_suggestion()
        svc.get_earnings_proximity.return_value = EarningsProximityResponse(ticker="BESI.AS")
        svc.fetch_recent_ohlcv.return_value = pd.DataFrame()
        return svc

    def override_fundamentals():
        svc = MagicMock()
        svc.get_snapshot.return_value = None
        return svc

    analyzer_instance = MagicMock()
    analyzer_instance.analyze.return_value = mock_intelligence

    app.dependency_overrides[get_portfolio_service] = override_portfolio
    app.dependency_overrides[get_fundamentals_service] = override_fundamentals
    try:
        with (
            patch("api.routers.intelligence._get_analyzer", return_value=analyzer_instance),
            patch("api.routers.intelligence.read_from_cache", return_value=None),
            patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}),
        ):
            response = client.post("/api/intelligence/position/pos-1")
    finally:
        app.dependency_overrides.pop(get_portfolio_service, None)
        app.dependency_overrides.pop(get_fundamentals_service, None)

    assert response.status_code == 200
    data = response.json()
    assert data["position_signal"]["action"] == "HOLD"
    assert data["summary_line"] == "Hold, thesis intact."
    # Position analysis now routes through the enrichment pipeline (OHLCV fetch attempted).
    analyzer_instance.analyze.assert_called_once()
    assert analyzer_instance.analyze.call_args.args[0] == "BESI.AS"
