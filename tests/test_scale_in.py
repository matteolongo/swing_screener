import pytest

from swing_screener.portfolio.state import Position, scale_in_position


def test_scale_in_position_weighted_entry_and_shares():
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-10",
        entry_price=100.0,
        stop_price=90.0,
        shares=10,
        initial_risk=10.0,
        max_favorable_price=120.0,
    )
    blended = scale_in_position(pos, add_entry_price=110.0, add_shares=5)
    assert blended.shares == 15
    assert blended.entry_price == pytest.approx((100.0 * 10 + 110.0 * 5) / 15, rel=1e-9)
    assert blended.stop_price == 90.0
    assert blended.initial_risk == pytest.approx(blended.entry_price - 90.0, abs=1e-4)
    assert blended.max_favorable_price == 120.0


def test_scale_in_position_invalid_blend_raises():
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-10",
        entry_price=100.0,
        stop_price=90.0,
        shares=10,
    )
    with pytest.raises(ValueError):
        scale_in_position(pos, add_entry_price=80.0, add_shares=10)
