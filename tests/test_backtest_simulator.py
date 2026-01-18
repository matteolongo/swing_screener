from dataclasses import replace

import pandas as pd
import pytest

from swing_screener.backtest.simulator import (
    backtest_single_ticker_R,
    BacktestConfig,
    summarize_trades,
)


def _make_ohlcv(data):
    df = pd.DataFrame(data)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_backtest_enters_next_open_and_exits_tp():
    idx = pd.date_range("2023-01-02", periods=5, freq="D")
    close = pd.Series([10, 11, 13, 15, 15], index=idx, dtype=float)
    open_ = pd.Series([10, 11, 13, 15, 15], index=idx, dtype=float)
    high = pd.Series([10.5, 11.5, 15.5, 17.0, 17.0], index=idx, dtype=float)
    low = pd.Series([9.5, 10.5, 12.5, 14.0, 14.0], index=idx, dtype=float)
    vol = pd.Series(1_000_000, index=idx, dtype=float)

    data = {
        ("Open", "AAA"): open_,
        ("High", "AAA"): high,
        ("Low", "AAA"): low,
        ("Close", "AAA"): close,
        ("Volume", "AAA"): vol,
    }
    ohlcv = _make_ohlcv(data)

    cfg = BacktestConfig(
        entry_type="breakout",
        breakout_lookback=1,
        atr_window=1,
        k_atr=1.0,
        take_profit_R=1.0,
        max_holding_days=5,
        min_history=1,
    )

    trades = backtest_single_ticker_R(ohlcv, "AAA", cfg)
    assert not trades.empty
    # Signal on day 1, enter day 2 open
    assert trades.iloc[0]["entry"] == open_.iloc[2]
    assert trades.iloc[0]["exit_type"] == "take_profit"

    summ = summarize_trades(trades)
    assert summ.loc[0, "trades"] == len(trades)


def test_time_stop_counts_bars_not_calendar_days():
    idx = pd.to_datetime(["2023-03-08", "2023-03-09", "2023-03-13", "2023-03-16", "2023-03-20"])
    close = pd.Series([90, 95, 101, 101, 101], index=idx, dtype=float)
    open_ = close.copy()
    high = close + 1.0
    low = close - 1.0
    vol = pd.Series(1_000_000, index=idx, dtype=float)

    ohlcv = _make_ohlcv(
        {
            ("Open", "AAA"): open_,
            ("High", "AAA"): high,
            ("Low", "AAA"): low,
            ("Close", "AAA"): close,
            ("Volume", "AAA"): vol,
        }
    )

    cfg = BacktestConfig(
        entry_type="breakout",
        breakout_lookback=2,
        atr_window=1,
        k_atr=1.0,
        take_profit_R=3.0,
        max_holding_days=1,
        min_history=1,
    )

    trades = backtest_single_ticker_R(ohlcv, "AAA", cfg)
    assert not trades.empty
    # Entry on 3rd bar open, time stop after 1 bar -> 5th bar despite calendar gaps
    assert trades.iloc[0]["exit_type"] == "time"
    assert trades.iloc[0]["exit_date"] == idx[4]


def test_gap_through_stop_exits_at_open():
    idx = pd.date_range("2023-01-02", periods=4, freq="D")
    close = pd.Series([100.0, 105.0, 105.0, 105.0], index=idx, dtype=float)
    open_ = close.copy()
    high = pd.Series([101.0, 106.0, 106.0, 106.0], index=idx, dtype=float)
    low = pd.Series([99.0, 104.0, 104.0, 104.0], index=idx, dtype=float)
    # Gap down after entry
    open_.iloc[3] = 80.0
    low.iloc[3] = 79.0
    close.iloc[3] = 82.0
    high.iloc[3] = 85.0
    vol = pd.Series(1_000_000, index=idx, dtype=float)

    ohlcv = _make_ohlcv(
        {
            ("Open", "AAA"): open_,
            ("High", "AAA"): high,
            ("Low", "AAA"): low,
            ("Close", "AAA"): close,
            ("Volume", "AAA"): vol,
        }
    )

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
    idx = pd.date_range("2023-02-01", periods=4, freq="D")
    close = pd.Series([100.0, 105.0, 105.0, 105.0], index=idx, dtype=float)
    open_ = pd.Series([100.0, 105.0, 105.0, 105.0], index=idx, dtype=float)
    high = pd.Series([102.0, 110.0, 120.0, 120.0], index=idx, dtype=float)
    low = pd.Series([98.0, 100.0, 85.0, 85.0], index=idx, dtype=float)
    vol = pd.Series(1_000_000, index=idx, dtype=float)

    ohlcv = _make_ohlcv(
        {
            ("Open", "AAA"): open_,
            ("High", "AAA"): high,
            ("Low", "AAA"): low,
            ("Close", "AAA"): close,
            ("Volume", "AAA"): vol,
        }
    )

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


def test_commission_reduces_R():
    idx = pd.date_range("2023-04-01", periods=5, freq="D")
    close = pd.Series([50.0, 52.0, 55.0, 55.0, 58.0], index=idx, dtype=float)
    open_ = close.copy()
    high = close + 1.0
    low = close - 1.0
    vol = pd.Series(1_000_000, index=idx, dtype=float)

    ohlcv = _make_ohlcv(
        {
            ("Open", "AAA"): open_,
            ("High", "AAA"): high,
            ("Low", "AAA"): low,
            ("Close", "AAA"): close,
            ("Volume", "AAA"): vol,
        }
    )

    base_cfg = BacktestConfig(
        entry_type="breakout",
        breakout_lookback=1,
        atr_window=1,
        k_atr=1.0,
        take_profit_R=1.0,
        max_holding_days=5,
        min_history=1,
    )
    cfg_commission = replace(base_cfg, commission_pct=0.01)

    base_trades = backtest_single_ticker_R(ohlcv, "AAA", base_cfg)
    comm_trades = backtest_single_ticker_R(ohlcv, "AAA", cfg_commission)

    assert base_trades.iloc[0]["R"] > comm_trades.iloc[0]["R"]
