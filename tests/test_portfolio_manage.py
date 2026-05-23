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


def test_trailing_suggestion_below_one_cent_does_not_trigger_move():
    # trailing stop raw value: 17.84325 * (1 - 0.005) = 17.75403375 -> rounds to 17.75
    closes = [17.84325] * 20
    ohlcv = _make_ohlcv({"AAA": closes})
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-01",
        entry_price=10.0,
        stop_price=17.75,
        shares=1,
        initial_risk=1.0,
    )
    updates, _ = evaluate_positions(
        ohlcv,
        [pos],
        ManageConfig(breakeven_at_R=999.0, trail_after_R=2.0, trail_sma=20, sma_buffer_pct=0.005, max_holding_days=999),
    )

    update = updates[0]
    assert update.stop_suggested == pytest.approx(17.75)
    assert update.action == "NO_ACTION"


# ─── Exit signal tests ───────────────────────────────────────────────────────

def _make_ohlcv_with_sma_break(ticker: str = "AAA") -> pd.DataFrame:
    """25 closes above SMA20 then 2 closes below it."""
    above = [110.0] * 23  # these form the SMA20 base (avg ~110)
    below = [95.0, 95.0]  # last 2 closes well below the ~110 SMA
    return _make_ohlcv({ticker: above + below})


def test_exit_signal_fires_when_two_consecutive_closes_below_sma20():
    ohlcv = _make_ohlcv_with_sma_break()
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-01",
        entry_price=100.0,
        stop_price=90.0,
        shares=1,
        initial_risk=10.0,
    )
    updates, _ = evaluate_positions(
        ohlcv, [pos], ManageConfig(exit_signal_days=2, max_holding_days=999)
    )
    assert updates[0].action == "CLOSE_EXIT_SIGNAL"
    assert "SMA20" in updates[0].reason


def test_exit_signal_does_not_fire_for_single_close_below_sma20():
    """Only 1 close below SMA — should not trigger with exit_signal_days=2."""
    above = [110.0] * 24
    mixed = [95.0]  # only last close below SMA
    ohlcv = _make_ohlcv({"AAA": above + mixed})
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-01",
        entry_price=100.0,
        stop_price=90.0,
        shares=1,
        initial_risk=10.0,
    )
    updates, _ = evaluate_positions(
        ohlcv, [pos], ManageConfig(exit_signal_days=2, max_holding_days=999)
    )
    assert updates[0].action != "CLOSE_EXIT_SIGNAL"


def test_stop_hit_takes_priority_over_exit_signal():
    """Stop hit wins over SMA20 break."""
    above = [110.0] * 23
    below = [85.0, 85.0]  # below both SMA20 and stop (stop=90)
    ohlcv = _make_ohlcv({"AAA": above + below})
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-01",
        entry_price=100.0,
        stop_price=90.0,
        shares=1,
        initial_risk=10.0,
    )
    updates, _ = evaluate_positions(
        ohlcv, [pos], ManageConfig(exit_signal_days=2, max_holding_days=999)
    )
    assert updates[0].action == "CLOSE_STOP_HIT"


def test_exit_signal_disabled_when_exit_signal_days_zero():
    ohlcv = _make_ohlcv_with_sma_break()
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-01",
        entry_price=100.0,
        stop_price=90.0,
        shares=1,
        initial_risk=10.0,
    )
    updates, _ = evaluate_positions(
        ohlcv, [pos], ManageConfig(exit_signal_days=0, max_holding_days=999)
    )
    assert updates[0].action != "CLOSE_EXIT_SIGNAL"
