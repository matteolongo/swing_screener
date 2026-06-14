import pandas as pd

from api.services.screener_service import _price_history_map


def _ohlcv():
    idx = pd.date_range("2024-01-01", periods=3, freq="B")
    cols = pd.MultiIndex.from_tuples(
        [
            ("Open", "AAA"),
            ("High", "AAA"),
            ("Low", "AAA"),
            ("Close", "AAA"),
            ("Volume", "AAA"),
        ],
        names=["field", "ticker"],
    )
    return pd.DataFrame(
        [
            [9.5, 10.2, 9.4, 10.0, 1000],
            [10.0, 10.5, 9.8, 10.3, 1200],
            [10.3, 10.6, 10.0, 10.4, 1100],
        ],
        index=idx,
        columns=cols,
    )


def test_price_history_map_includes_ohlcv():
    out = _price_history_map(_ohlcv(), tickers=["AAA"])
    point = out["AAA"][0]
    assert point["close"] == 10.0
    assert point["open"] == 9.5
    assert point["high"] == 10.2
    assert point["low"] == 9.4
    assert point["volume"] == 1000


def test_price_history_map_close_only_when_ohlc_absent():
    idx = pd.date_range("2024-01-01", periods=2, freq="B")
    cols = pd.MultiIndex.from_tuples([("Close", "AAA")], names=["field", "ticker"])
    df = pd.DataFrame([[10.0], [10.5]], index=idx, columns=cols)
    out = _price_history_map(df, tickers=["AAA"])
    point = out["AAA"][0]
    assert point["close"] == 10.0
    assert "open" not in point and "volume" not in point
