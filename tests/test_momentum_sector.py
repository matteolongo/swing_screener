from __future__ import annotations

import numpy as np
import pandas as pd
import pytest


def test_build_feature_table_accepts_sector_benchmark_returns():
    from swing_screener.selection.universe import UniverseConfig, build_feature_table

    n = 270
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    tickers = ["AAPL", "SPY"]
    arrays = {
        (field, ticker): 100
        + np.cumsum(np.random.default_rng(hash(ticker + field) % 100).normal(0, 0.5, n))
        for field in ("Close", "High", "Low", "Volume")
        for ticker in tickers
    }
    ohlcv = pd.DataFrame(arrays, index=dates)
    ohlcv.columns = pd.MultiIndex.from_tuples(ohlcv.columns)

    sector_returns = {"AAPL": 0.07}
    feats = build_feature_table(
        ohlcv,
        UniverseConfig(),
        sector_benchmark_returns=sector_returns,
    )

    assert "sector_rs_6m" in feats.columns
    if "AAPL" in feats.index:
        expected = feats.loc["AAPL", "mom_6m"] - 0.07
        assert feats.loc["AAPL", "sector_rs_6m"] == pytest.approx(expected, abs=1e-4)
