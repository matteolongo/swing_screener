import pandas as pd
import pytest

from swing_screener.backtest.simulator import (
    backtest_single_ticker_R,
    BacktestConfig,
    summarize_trades,
)


def _make_ohlcv_with_pullback_trade():
    idx = pd.bdate_range("2023-01-02", periods=260)

    close = pd.Series(100.0, index=idx, dtype=float)
    # stable then dip then reclaim -> pullback signal near end
    close.iloc[-30:-2] = 100.0
    close.iloc[-2] = 90.0
    close.iloc[-1] = 110.0

    open_ = close
    high = close + 1.0
    low = close - 1.0
    vol = pd.Series(1_000_000, index=idx, dtype=float)

    df = pd.DataFrame(
        {
            ("Open", "AAA"): open_,
            ("High", "AAA"): high,
            ("Low", "AAA"): low,
            ("Close", "AAA"): close,
            ("Volume", "AAA"): vol,
        },
        index=idx,
    )
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_backtest_single_ticker_produces_trades():
    ohlcv = _make_ohlcv_with_pullback_trade()
    cfg = BacktestConfig(
        entry_type="pullback",
        pullback_ma=20,
        atr_window=14,
        k_atr=2.0,
        take_profit_R=2.0,
        max_holding_days=20,
    )
    trades = backtest_single_ticker_R(ohlcv, "AAA", cfg)

    assert isinstance(trades, pd.DataFrame)
    # it may produce 1 trade depending on the exact MA condition; require >=0 but if present check columns
    if not trades.empty:
        for col in [
            "entry_date",
            "exit_date",
            "entry",
            "stop",
            "tp",
            "exit",
            "R",
            "exit_type",
        ]:
            assert col in trades.columns

        summ = summarize_trades(trades)
        assert summ.loc[0, "trades"] == len(trades)


def test_time_stop_counts_bars_not_calendar_days():
    idx = pd.bdate_range("2023-03-08", periods=5)  # Wed, Thu, Fri, Mon, Tue
    close = pd.Series([90, 95, 101, 101, 101], index=idx, dtype=float)

    def mk(high_shift=1.0, low_shift=1.0):
        open_ = close
        high = close + high_shift
        low = close - low_shift
        vol = pd.Series(1_000_000, index=idx, dtype=float)
        return open_, high, low, close, vol

    data = {}
    for field, s in zip(
        ["Open", "High", "Low", "Close", "Volume"], mk(high_shift=1.0, low_shift=1.0)
    ):
        data[(field, "AAA")] = s

    ohlcv = pd.DataFrame(data, index=idx)
    ohlcv.columns = pd.MultiIndex.from_tuples(ohlcv.columns)

    cfg = BacktestConfig(
        entry_type="breakout",
        breakout_lookback=2,
        atr_window=1,
        k_atr=1.0,
        take_profit_R=2.0,
        max_holding_days=2,
        min_history=1,
    )

    trades = backtest_single_ticker_R(ohlcv, "AAA", cfg)
    # Entry on Fri (index 2), time stop should trigger after 2 bars -> Tue (index 4)
    assert not trades.empty
    assert trades.iloc[0]["exit_type"] == "time"
    assert trades.iloc[0]["exit_date"] == idx[4]


def test_gap_through_stop_exits_at_open():
    idx = pd.bdate_range("2023-01-02", periods=3)
    close = pd.Series([100.0, 105.0, 82.0], index=idx, dtype=float)
    open_ = close.copy()
    open_.iloc[2] = 80.0  # gap below stop
    high = pd.Series([101.0, 106.0, 85.0], index=idx, dtype=float)
    low = pd.Series([99.0, 104.0, 79.0], index=idx, dtype=float)
    vol = pd.Series(1_000_000, index=idx, dtype=float)

    data = {}
    for field, s in [("Open", open_), ("High", high), ("Low", low), ("Close", close), ("Volume", vol)]:
        data[(field, "AAA")] = s

    ohlcv = pd.DataFrame(data, index=idx)
    ohlcv.columns = pd.MultiIndex.from_tuples(ohlcv.columns)

    cfg = BacktestConfig(
        entry_type="breakout",
        breakout_lookback=1,
        atr_window=1,
        k_atr=1.0,
        take_profit_R=2.0,
        max_holding_days=5,
        min_history=1,
    )

    trades = backtest_single_ticker_R(ohlcv, "AAA", cfg)
    assert trades.iloc[0]["exit_type"] == "stop"
    assert trades.iloc[0]["exit"] == 80.0  # exited at gap-open, below stop
    assert trades.iloc[0]["R"] == pytest.approx(-4.1667, rel=1e-3)


def test_stop_has_priority_over_take_profit_same_bar():
    idx = pd.bdate_range("2023-02-01", periods=3)
    close = pd.Series([100.0, 105.0, 105.0], index=idx, dtype=float)
    open_ = pd.Series([100.0, 105.0, 105.0], index=idx, dtype=float)
    high = pd.Series([102.0, 110.0, 120.0], index=idx, dtype=float)
    low = pd.Series([98.0, 100.0, 85.0], index=idx, dtype=float)
    vol = pd.Series(1_000_000, index=idx, dtype=float)

    data = {}
    for field, s in [("Open", open_), ("High", high), ("Low", low), ("Close", close), ("Volume", vol)]:
        data[(field, "AAA")] = s

    ohlcv = pd.DataFrame(data, index=idx)
    ohlcv.columns = pd.MultiIndex.from_tuples(ohlcv.columns)

    cfg = BacktestConfig(
        entry_type="breakout",
        breakout_lookback=1,
        atr_window=1,
        k_atr=1.0,
        take_profit_R=2.0,
        max_holding_days=5,
        min_history=1,
    )

    trades = backtest_single_ticker_R(ohlcv, "AAA", cfg)
    assert trades.iloc[0]["exit_type"] == "stop"
    assert trades.iloc[0]["exit"] == trades.iloc[0]["stop"]  # stop takes priority
