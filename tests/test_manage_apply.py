import pandas as pd

from swing_screener.portfolio.state import (
    Position,
    ManageConfig,
    evaluate_positions,
    apply_stop_updates,
)


def _make_ohlcv(close_by_ticker: dict[str, list[float]]) -> pd.DataFrame:
    idx = pd.date_range(
        "2026-01-01", periods=len(next(iter(close_by_ticker.values()))), freq="B"
    )
    data = {}
    for t, closes in close_by_ticker.items():
        for f in ["Open", "High", "Low", "Close"]:
            data[(f, t)] = closes
        data[("Volume", t)] = [100] * len(closes)
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_apply_moves_stop_up_only():
    # entry 100, stop 90 -> risk=10; last 110 -> +1R -> suggest stop 100
    ohlcv = _make_ohlcv({"AAA": [100, 105, 110]})
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-01",
        entry_price=100.0,
        stop_price=90.0,
        shares=1,
    )

    updates, new_positions = evaluate_positions(
        ohlcv, [pos], ManageConfig(breakeven_at_R=1.0, trail_after_R=999.0)
    )
    applied = apply_stop_updates(new_positions, updates)

    assert applied[0].stop_price == 100.0


def test_apply_never_lowers_stop():
    ohlcv = _make_ohlcv({"AAA": [100, 99, 98]})
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date="2026-01-01",
        entry_price=100.0,
        stop_price=95.0,
        shares=1,
    )

    updates, new_positions = evaluate_positions(ohlcv, [pos], ManageConfig())
    applied = apply_stop_updates(new_positions, updates)

    assert applied[0].stop_price >= 95.0
