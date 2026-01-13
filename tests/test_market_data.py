import pandas as pd
from swing_screener.data.market_data import fetch_ohlcv, MarketDataConfig


def test_fetch_ohlcv_returns_multiindex():
    df = fetch_ohlcv(
        ["AAPL", "MSFT", "SPY"], MarketDataConfig(start="2023-01-01"), use_cache=False
    )
    assert isinstance(df, pd.DataFrame)
    assert isinstance(df.columns, pd.MultiIndex)
    assert ("Close", "AAPL") in df.columns
