import pandas as pd

from swing_screener.backtest.portfolio import drawdown_stats


def test_drawdown_stats_basic():
    curve = pd.DataFrame({"cum_R": [0, 1, -1, 2, 1]})
    stats = drawdown_stats(curve)
    assert stats["max_drawdown_R"] == -2.0


def test_drawdown_stats_empty():
    stats = drawdown_stats(pd.DataFrame())
    assert stats["max_drawdown_R"] is None
