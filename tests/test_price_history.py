import pandas as pd
from swing_screener.data.price_history import (
    merge_ohlcv,
    price_history_map,
    price_history_change_pct,
)


def _frame(ticker, closes, dates):
    cols = pd.MultiIndex.from_tuples([("Close", ticker), ("Volume", ticker)])
    data = [[c, 1000] for c in closes]
    return pd.DataFrame(data, index=pd.to_datetime(dates), columns=cols)


def test_merge_ohlcv_unions_columns():
    a = _frame("AAA", [1, 2], ["2024-01-01", "2024-01-02"])
    b = _frame("BBB", [3, 4], ["2024-01-01", "2024-01-02"])
    merged = merge_ohlcv(a, b)
    assert ("Close", "AAA") in merged.columns
    assert ("Close", "BBB") in merged.columns


def test_price_history_change_pct_computes_first_to_last():
    history = [{"close": 100.0}, {"close": 110.0}]
    assert price_history_change_pct(history) == 10.0


def test_price_history_change_pct_handles_empty():
    assert price_history_change_pct([]) is None


def test_price_history_map_returns_close_points():
    a = _frame("AAA", [10.0, 20.0], ["2024-01-01", "2024-01-02"])
    result = price_history_map(a, tickers=["AAA"])
    assert "AAA" in result
    assert result["AAA"][0]["close"] == 10.0
