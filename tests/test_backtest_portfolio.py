import pandas as pd

from swing_screener.backtest.portfolio import (
    backtest_portfolio_R,
    equity_curve_R,
    PortfolioBacktestConfig,
)
from swing_screener.backtest.simulator import BacktestConfig


def _make_ohlcv_two_tickers():
    idx = pd.bdate_range("2023-01-02", periods=260)

    # AAA: rising + breakout
    close_a = pd.Series(range(100, 360), index=idx, dtype=float)
    close_a.iloc[-1] = close_a.iloc[-2] + 30

    # BBB: similar
    close_b = pd.Series(range(120, 380), index=idx, dtype=float)
    close_b.iloc[-1] = close_b.iloc[-2] + 30

    def mk(close: pd.Series):
        open_ = close
        high = close + 2.0
        low = close - 2.0
        vol = pd.Series(1_000_000, index=close.index, dtype=float)
        return open_, high, low, close, vol

    o_a, h_a, l_a, c_a, v_a = mk(close_a)
    o_b, h_b, l_b, c_b, v_b = mk(close_b)

    data = {}
    for field, s_a, s_b in [
        ("Open", o_a, o_b),
        ("High", h_a, h_b),
        ("Low", l_a, l_b),
        ("Close", c_a, c_b),
        ("Volume", v_a, v_b),
    ]:
        data[(field, "AAA")] = s_a
        data[(field, "BBB")] = s_b

    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_backtest_portfolio_outputs():
    ohlcv = _make_ohlcv_two_tickers()
    cfg = PortfolioBacktestConfig(
        bt=BacktestConfig(entry_type="breakout", breakout_lookback=50)
    )

    trades_all, by_ticker, total = backtest_portfolio_R(ohlcv, ["AAA", "BBB"], cfg)

    assert isinstance(trades_all, pd.DataFrame)
    assert isinstance(by_ticker, pd.DataFrame)
    assert isinstance(total, pd.DataFrame)
    assert "R" in trades_all.columns
    assert total.shape[0] == 1


def test_equity_curve_has_cum_R():
    ohlcv = _make_ohlcv_two_tickers()
    cfg = PortfolioBacktestConfig(
        bt=BacktestConfig(entry_type="breakout", breakout_lookback=50)
    )

    trades_all, _, _ = backtest_portfolio_R(ohlcv, ["AAA", "BBB"], cfg)
    curve = equity_curve_R(trades_all)

    if not curve.empty:
        assert "cum_R" in curve.columns
        assert float(curve["cum_R"].iloc[-1]) == float(curve["R"].sum())
