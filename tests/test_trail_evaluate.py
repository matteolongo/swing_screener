"""Tests for F13: per-position trail method customization in evaluate_positions."""
import math
import pandas as pd
import pytest
from swing_screener.portfolio.state import ManageConfig, Position, evaluate_positions


def _make_ohlcv(ticker: str, closes: list) -> pd.DataFrame:
    n = len(closes)
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    highs = [c + 0.5 for c in closes]
    lows = [c - 0.5 for c in closes]
    tuples = (
        [("High", ticker)] * n
        + [("Low", ticker)] * n
        + [("Close", ticker)] * n
    )
    idx = pd.MultiIndex.from_tuples(tuples)
    values = highs + lows + closes
    df = pd.DataFrame([values], columns=idx, index=dates[:1])
    # Expand to n rows
    rows = []
    for i, d in enumerate(dates):
        row = {("High", ticker): highs[i], ("Low", ticker): lows[i], ("Close", ticker): closes[i]}
        rows.append(row)
    df = pd.DataFrame(rows, index=dates)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def _pos_at_3r(ticker: str, trail_method: str, trail_param=None) -> Position:
    return Position(
        ticker=ticker,
        status="open",
        entry_date="2024-01-01",
        entry_price=100.0,
        stop_price=90.0,  # 1R = 10
        shares=10,
        trail_method=trail_method,
        trail_param=trail_param,
    )


@pytest.fixture
def ohlcv_above_entry():
    # 50 bars ending at 130 → R = (130-100)/10 = 3.0
    closes = [101.0] * 30 + [120.0] * 10 + [130.0] * 10
    return _make_ohlcv("AAPL", closes)


def test_sma20_trail_triggers(ohlcv_above_entry):
    pos = _pos_at_3r("AAPL", "sma20")
    # max_holding_days=0 disables time-exit; entry_date far enough back for bars to count
    cfg = ManageConfig(trail_after_R=2.0, trail_sma=20, sma_buffer_pct=0.005, max_holding_days=0)
    updates, _ = evaluate_positions(ohlcv_above_entry, [pos], cfg)
    assert updates[0].action == "MOVE_STOP_UP"
    assert "SMA20" in updates[0].reason


def test_atr_trail_stop_moves_up(ohlcv_above_entry):
    pos = _pos_at_3r("AAPL", "atr", 2.0)
    cfg = ManageConfig(trail_after_R=2.0, max_holding_days=0)
    updates, _ = evaluate_positions(ohlcv_above_entry, [pos], cfg)
    update = updates[0]
    # ATR on constant 1.0-range bars ≈ 1.0; stop ≈ 130 - 2.0 = 128 > 90
    assert update.stop_suggested >= pos.stop_price
    assert "ATR" in update.reason


def test_fixed_pct_trail_stop_correct(ohlcv_above_entry):
    pos = _pos_at_3r("AAPL", "fixed_pct", 5.0)
    cfg = ManageConfig(trail_after_R=2.0, max_holding_days=0)
    updates, _ = evaluate_positions(ohlcv_above_entry, [pos], cfg)
    update = updates[0]
    # last=130; 5% trail → 130 * 0.95 = 123.5
    assert abs(update.stop_suggested - 130.0 * 0.95) < 0.02
    assert "Fixed" in update.reason


def test_manual_trail_no_trail_beyond_breakeven(ohlcv_above_entry):
    pos = _pos_at_3r("AAPL", "manual")
    cfg = ManageConfig(trail_after_R=2.0, max_holding_days=0)
    updates, _ = evaluate_positions(ohlcv_above_entry, [pos], cfg)
    update = updates[0]
    # manual: no trail; breakeven rule fires (stop moves to entry=100)
    # stop_suggested must not exceed entry price (no trail beyond breakeven)
    assert update.stop_suggested <= pos.entry_price + 0.01
