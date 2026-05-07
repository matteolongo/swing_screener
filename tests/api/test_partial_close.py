from __future__ import annotations

import json
from pathlib import Path
import pytest
from fastapi import HTTPException
from api.models.portfolio import (
    PartialCloseRequest,
    PartialCloseEvent,
    Position,
    PositionMetrics,
)
from api.services.portfolio_service import PortfolioService
from api.repositories.positions_repo import PositionsRepository
from api.repositories.orders_repo import OrdersRepository


def test_partial_close_request_valid():
    req = PartialCloseRequest(shares_closed=5, price=25.0)
    assert req.shares_closed == 5
    assert req.price == 25.0
    assert req.fee_eur is None


def test_partial_close_request_rejects_zero_shares():
    with pytest.raises(Exception):
        PartialCloseRequest(shares_closed=0, price=25.0)


def test_partial_close_request_rejects_negative_price():
    with pytest.raises(Exception):
        PartialCloseRequest(shares_closed=5, price=-1.0)


def test_partial_close_event_fields():
    evt = PartialCloseEvent(date="2026-05-08", shares_closed=5, price=25.0, r_at_close=1.5)
    assert evt.r_at_close == 1.5
    assert evt.shares_closed == 5


def test_position_has_partial_closes_field():
    pos = Position(
        ticker="AAPL",
        status="open",
        entry_date="2026-01-01",
        entry_price=20.0,
        stop_price=18.0,
        shares=10,
    )
    assert pos.partial_closes == []


def test_position_metrics_has_partial_closes_and_blended_r():
    metrics = PositionMetrics(
        ticker="AAPL",
        pnl=100.0,
        pnl_percent=5.0,
        r_now=1.5,
        entry_value=2000.0,
        current_value=2100.0,
        per_share_risk=2.0,
        total_risk=20.0,
        partial_closes=[],
        blended_r=None,
    )
    assert metrics.blended_r is None
    assert metrics.partial_closes == []


# ---------------------------------------------------------------------------
# Service tests
# ---------------------------------------------------------------------------

def _open_position(position_id: str = "POS-001") -> dict:
    return {
        "position_id": position_id,
        "ticker": "AAPL",
        "status": "open",
        "entry_date": "2026-01-01",
        "entry_price": 20.0,
        "stop_price": 18.0,
        "shares": 10,
        "initial_risk": 20.0,  # (20 - 18) * 10
        "partial_closes": [],
    }


def _make_service_simple(tmp_path: Path) -> PortfolioService:
    pos = _open_position()
    pos_file = tmp_path / "positions.json"
    pos_file.write_text(json.dumps({"positions": [pos], "asof": "2026-01-01"}))
    ord_file = tmp_path / "orders.json"
    ord_file.write_text(json.dumps({"orders": [], "asof": "2026-01-01"}))
    return PortfolioService(
        positions_repo=PositionsRepository(pos_file),
        orders_repo=OrdersRepository(ord_file),
    )


def test_partial_close_reduces_shares(tmp_path):
    svc = _make_service_simple(tmp_path)
    req = PartialCloseRequest(shares_closed=4, price=22.0)
    result = svc.partial_close_position("POS-001", req)
    assert result["shares_remaining"] == 6


def test_partial_close_records_event(tmp_path: Path):
    pos_file = tmp_path / "positions.json"
    svc = _make_service_simple(tmp_path)
    req = PartialCloseRequest(shares_closed=4, price=22.0)
    svc.partial_close_position("POS-001", req)
    data = json.loads(pos_file.read_text())
    pos = data["positions"][0]
    assert len(pos["partial_closes"]) == 1
    evt = pos["partial_closes"][0]
    assert evt["shares_closed"] == 4
    assert evt["price"] == 22.0
    assert abs(evt["r_at_close"] - 1.0) < 0.001  # (22-20)/(20-18) = 1.0


def test_partial_close_preserves_initial_risk(tmp_path: Path):
    pos_file = tmp_path / "positions.json"
    svc = _make_service_simple(tmp_path)
    req = PartialCloseRequest(shares_closed=4, price=22.0)
    svc.partial_close_position("POS-001", req)
    data = json.loads(pos_file.read_text())
    pos = data["positions"][0]
    assert pos["initial_risk"] == 20.0  # unchanged


def test_partial_close_rejects_closing_all_shares(tmp_path):
    svc = _make_service_simple(tmp_path)
    req = PartialCloseRequest(shares_closed=10, price=22.0)
    with pytest.raises(HTTPException) as exc_info:
        svc.partial_close_position("POS-001", req)
    assert exc_info.value.status_code == 400


def test_partial_close_rejects_closed_position(tmp_path):
    pos = _open_position()
    pos["status"] = "closed"
    pos["exit_price"] = 22.0
    pos_file = tmp_path / "positions.json"
    pos_file.write_text(json.dumps({"positions": [pos], "asof": "2026-01-01"}))
    ord_file = tmp_path / "orders.json"
    ord_file.write_text(json.dumps({"orders": [], "asof": "2026-01-01"}))
    svc = PortfolioService(
        positions_repo=PositionsRepository(pos_file),
        orders_repo=OrdersRepository(ord_file),
    )
    req = PartialCloseRequest(shares_closed=5, price=22.0)
    with pytest.raises(HTTPException) as exc_info:
        svc.partial_close_position("POS-001", req)
    assert exc_info.value.status_code == 400
