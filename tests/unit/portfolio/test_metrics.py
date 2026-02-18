"""Tests for portfolio metrics calculations."""
from __future__ import annotations

import pytest

from swing_screener.portfolio.metrics import (
    calculate_current_position_value,
    calculate_per_share_risk,
    calculate_pnl,
    calculate_r_now,
    calculate_total_position_value,
)
from swing_screener.portfolio.state import Position


def _position(**overrides) -> Position:
    base = {
        "ticker": "VALE",
        "status": "open",
        "entry_date": "2026-01-15",
        "entry_price": 15.89,
        "stop_price": 14.60,
        "shares": 6,
        "initial_risk": 1.29,
    }
    base.update(overrides)
    return Position(**base)


def test_calculate_pnl() -> None:
    assert calculate_pnl(entry_price=15.89, current_price=16.65, shares=6) == pytest.approx(4.56, abs=0.01)
    assert calculate_pnl(entry_price=20.0, current_price=18.0, shares=10) == pytest.approx(-20.0, abs=0.01)
    assert calculate_pnl(entry_price=15.0, current_price=15.0, shares=5) == 0.0


def test_calculate_r_now_with_initial_risk() -> None:
    pos = _position()

    assert calculate_r_now(pos, current_price=16.65) == pytest.approx(0.59, abs=0.01)
    assert calculate_r_now(pos, current_price=15.89) == pytest.approx(0.0, abs=0.01)
    assert calculate_r_now(pos, current_price=14.60) == pytest.approx(-1.0, abs=0.01)


def test_calculate_r_now_falls_back_to_entry_stop_risk() -> None:
    pos = _position(initial_risk=None)
    assert calculate_r_now(pos, current_price=16.65) == pytest.approx(0.59, abs=0.01)


def test_calculate_r_now_returns_zero_for_invalid_risk_or_size() -> None:
    assert calculate_r_now(_position(initial_risk=0.0), current_price=16.65) == pytest.approx(0.59, abs=0.01)
    assert calculate_r_now(_position(initial_risk=None, stop_price=16.0), current_price=16.65) == 0.0
    assert calculate_r_now(_position(shares=0), current_price=16.65) == 0.0


def test_calculate_position_values() -> None:
    assert calculate_total_position_value(entry_price=15.89, shares=6) == pytest.approx(95.34, abs=0.01)
    assert calculate_current_position_value(current_price=16.65, shares=6) == pytest.approx(99.90, abs=0.01)


def test_calculate_per_share_risk() -> None:
    assert calculate_per_share_risk(_position(initial_risk=1.29)) == pytest.approx(1.29, abs=1e-9)
    assert calculate_per_share_risk(_position(initial_risk=None, stop_price=14.60)) == pytest.approx(1.29, abs=0.01)
