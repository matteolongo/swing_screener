import pandas as pd
import pytest
from swing_screener.portfolio.state import Position, evaluate_positions, ManageConfig


def _make_ohlcv(close_by_ticker: dict[str, list[float]]) -> pd.DataFrame:
    idx = pd.date_range(
        "2026-01-01", periods=len(next(iter(close_by_ticker.values()))), freq="B"
    )
    cols = []
    data = {}
    for t, closes in close_by_ticker.items():
        data[("Close", t)] = closes
        # dummy other fields not needed
        data[("Open", t)] = closes
        data[("High", t)] = closes
        data[("Low", t)] = closes
        data[("Volume", t)] = [100] * len(closes)
        cols.extend([("Close", t), ("Open", t), ("High", t), ("Low", t), ("Volume", t)])
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_breakeven_rule_moves_stop_to_entry():
    # entry 100, stop 90 => risk_per_share=10. last=110 => +1R => suggest stop=100
    ohlcv = _make_ohlcv({"AAA": [100, 105, 110]})
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-01",
        entry_price=100.0,
        stop_price=90.0,
        shares=1,
    )
    updates, _ = evaluate_positions(
        ohlcv, [pos], ManageConfig(breakeven_at_R=1.0, trail_after_R=999)
    )
    u = updates[0]
    assert u.action == "MOVE_STOP_UP"
    assert abs(u.stop_suggested - 100.0) < 1e-9


def test_stop_hit_triggers_close():
    ohlcv = _make_ohlcv({"AAA": [100, 92, 89]})
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-01",
        entry_price=100.0,
        stop_price=90.0,
        shares=1,
    )
    updates, _ = evaluate_positions(ohlcv, [pos], ManageConfig())
    assert updates[-1].action == "CLOSE_STOP_HIT"


def test_trailing_stop_above_entry_uses_initial_risk():
    ohlcv = _make_ohlcv({"AAA": [100, 105, 110]})
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-01",
        entry_price=100.0,
        stop_price=105.0,
        shares=1,
        initial_risk=10.0,
    )
    updates, _ = evaluate_positions(ohlcv, [pos], ManageConfig())
    assert updates[0].r_now == pytest.approx(1.0)


def test_trailing_stop_above_entry_without_initial_risk_errors():
    ohlcv = _make_ohlcv({"AAA": [100, 105, 110]})
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-01",
        entry_price=100.0,
        stop_price=105.0,
        shares=1,
    )
    with pytest.raises(ValueError):
        evaluate_positions(ohlcv, [pos], ManageConfig())
