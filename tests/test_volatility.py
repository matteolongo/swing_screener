import pandas as pd

from swing_screener.indicators.volatility import (
    compute_volatility_features,
    VolatilityConfig,
    compute_atr,
)


def _make_synthetic_ohlcv_constant_range():
    """
    Create deterministic OHLCV where for each day:
      high = close + 1
      low  = close - 1
    and close increases linearly.
    This yields TR ~ 2 most days (except first due to prev_close).
    """
    idx = pd.bdate_range("2023-01-02", periods=260)

    close_aaa = pd.Series(range(100, 360), index=idx, dtype=float)  # increasing
    close_bbb = pd.Series(range(360, 100, -1), index=idx, dtype=float)  # decreasing

    def mk(close: pd.Series):
        open_ = close
        high = close + 1.0
        low = close - 1.0
        vol = pd.Series(1_000_000, index=close.index, dtype=float)
        return open_, high, low, close, vol

    o_a, h_a, l_a, c_a, v_a = mk(close_aaa)
    o_b, h_b, l_b, c_b, v_b = mk(close_bbb)

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


def test_compute_volatility_features_columns():
    ohlcv = _make_synthetic_ohlcv_constant_range()
    feats = compute_volatility_features(ohlcv, VolatilityConfig(atr_window=14))

    assert "AAA" in feats.index
    assert "BBB" in feats.index
    assert "atr14" in feats.columns
    assert "atr_pct" in feats.columns

    assert feats.loc["AAA", "atr14"] > 0
    assert feats.loc["AAA", "atr_pct"] > 0


def test_atr_is_about_2_for_constant_range():
    ohlcv = _make_synthetic_ohlcv_constant_range()

    high = ohlcv["High"]
    low = ohlcv["Low"]
    close = ohlcv["Close"]

    atr = compute_atr(high[["AAA"]], low[["AAA"]], close[["AAA"]], window=14)

    # take last ATR value
    last_atr = float(atr["AAA"].iloc[-1])

    # TR should be ~2 most days in this synthetic dataset, so ATR ~2
    assert 1.9 < last_atr < 2.1


def test_compute_volatility_features_empty_ohlcv():
    cols = pd.MultiIndex.from_product(
        [["Open", "High", "Low", "Close", "Volume"], ["AAA"]]
    )
    ohlcv = pd.DataFrame(columns=cols)
    feats = compute_volatility_features(ohlcv, VolatilityConfig(atr_window=14))
    assert feats.empty


def test_compute_volatility_features_handles_sparse_calendar_gaps():
    ohlcv = _make_synthetic_ohlcv_constant_range()

    for field in ["Open", "High", "Low", "Close", "Volume"]:
        ohlcv.loc[ohlcv.index[::8], (field, "BBB")] = float("nan")
        ohlcv.loc[ohlcv.index[-1], (field, "BBB")] = float("nan")

    feats = compute_volatility_features(ohlcv, VolatilityConfig(atr_window=14))

    assert "BBB" in feats.index
    assert pd.notna(feats.loc["BBB", "atr14"])
