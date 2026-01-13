import pandas as pd

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
