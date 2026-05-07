from __future__ import annotations

import pytest
from api.models.portfolio import (
    PartialCloseRequest,
    PartialCloseEvent,
    Position,
    PositionMetrics,
)


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
