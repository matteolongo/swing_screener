import pandas as pd

from swing_screener.indicators.trend import compute_trend_features, TrendConfig


def _make_synthetic_ohlcv():
    # 260 business days, two tickers
    idx = pd.bdate_range("2023-01-02", periods=260)

    # Make AAA trending up, BBB trending down
    close_aaa = pd.Series(range(100, 360), index=idx, dtype=float)
    close_bbb = pd.Series(range(360, 100, -1), index=idx, dtype=float)

    def mk_ohlc(close: pd.Series):
        # Simple OHLC around close (deterministic)
        open_ = close * 0.99
        high = close * 1.01
        low = close * 0.98
        vol = pd.Series(1_000_000, index=close.index, dtype=float)
        return open_, high, low, close, vol

    o_a, h_a, l_a, c_a, v_a = mk_ohlc(close_aaa)
    o_b, h_b, l_b, c_b, v_b = mk_ohlc(close_bbb)

    cols = []
    data = {}

    for field, s_a, s_b in [
        ("Open", o_a, o_b),
        ("High", h_a, h_b),
        ("Low", l_a, l_b),
        ("Close", c_a, c_b),
        ("Volume", v_a, v_b),
    ]:
        cols.append((field, "AAA"))
        cols.append((field, "BBB"))
        data[(field, "AAA")] = s_a
        data[(field, "BBB")] = s_b

    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_compute_trend_features_columns_and_index():
    ohlcv = _make_synthetic_ohlcv()
    feats = compute_trend_features(ohlcv, TrendConfig())

    assert isinstance(feats, pd.DataFrame)
    assert "AAA" in feats.index
    assert "BBB" in feats.index

    for col in [
        "last",
        "sma20",
        "sma50",
        "sma200",
        "trend_ok",
        "dist_sma50_pct",
        "dist_sma200_pct",
    ]:
        assert col in feats.columns

    assert feats["trend_ok"].dtype == bool


def test_trend_ok_true_for_uptrend_false_for_downtrend():
    ohlcv = _make_synthetic_ohlcv()
    feats = compute_trend_features(ohlcv, TrendConfig())

    # AAA is uptrend -> should satisfy last > sma200 and sma50 > sma200
    assert bool(feats.loc["AAA", "trend_ok"]) is True
    assert bool(feats.loc["BBB", "trend_ok"]) is False
