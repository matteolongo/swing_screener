import pandas as pd

from swing_screener.indicators.momentum import (
    compute_momentum_features,
    MomentumConfig,
    compute_returns,
)


def _make_synthetic_ohlcv_for_momentum():
    idx = pd.bdate_range("2023-01-02", periods=260)

    # SPY: moderate uptrend
    close_spy = pd.Series(range(100, 360), index=idx, dtype=float)

    # AAA: stronger uptrend (outperforms)
    close_aaa = close_spy * 1.20

    # BBB: flat-ish (underperforms)
    close_bbb = pd.Series(200.0, index=idx, dtype=float)

    def mk(close: pd.Series):
        open_ = close * 0.99
        high = close * 1.01
        low = close * 0.98
        vol = pd.Series(1_000_000, index=close.index, dtype=float)
        return open_, high, low, close, vol

    o_s, h_s, l_s, c_s, v_s = mk(close_spy)
    o_a, h_a, l_a, c_a, v_a = mk(close_aaa)
    o_b, h_b, l_b, c_b, v_b = mk(close_bbb)

    data = {}
    for field, s_spy, s_aaa, s_bbb in [
        ("Open", o_s, o_a, o_b),
        ("High", h_s, h_a, h_b),
        ("Low", l_s, l_a, l_b),
        ("Close", c_s, c_a, c_b),
        ("Volume", v_s, v_a, v_b),
    ]:
        data[(field, "SPY")] = s_spy
        data[(field, "AAA")] = s_aaa
        data[(field, "BBB")] = s_bbb

    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_compute_returns_basic():
    idx = pd.bdate_range("2023-01-02", periods=10)
    close = pd.DataFrame(
        {
            "AAA": pd.Series(
                [10, 11, 12, 13, 14, 15, 16, 17, 18, 20], index=idx, dtype=float
            )
        }
    )
    r = compute_returns(close, lookback=5)
    # last=20, prev (5 bars back) is value at -6 index -> 14
    assert abs(float(r["AAA"]) - (20 / 14 - 1.0)) < 1e-12


def test_momentum_features_columns_and_benchmark_removed():
    ohlcv = _make_synthetic_ohlcv_for_momentum()
    feats = compute_momentum_features(ohlcv, MomentumConfig(benchmark="SPY"))

    assert "mom_6m" in feats.columns
    assert "mom_12m" in feats.columns
    assert "rs_6m" in feats.columns

    assert "AAA" in feats.index
    assert "BBB" in feats.index
    assert "SPY" not in feats.index


def test_relative_strength_signs():
    ohlcv = _make_synthetic_ohlcv_for_momentum()
    feats = compute_momentum_features(ohlcv, MomentumConfig(benchmark="SPY"))

    # AAA outperforms SPY -> rs positive
    assert float(feats.loc["AAA", "rs_6m"]) > 0.0

    # BBB underperforms SPY -> rs negative
    assert float(feats.loc["BBB", "rs_6m"]) < 0.0


def test_momentum_features_empty_ohlcv():
    cols = pd.MultiIndex.from_product(
        [["Open", "High", "Low", "Close", "Volume"], ["SPY"]]
    )
    ohlcv = pd.DataFrame(columns=cols)
    feats = compute_momentum_features(ohlcv, MomentumConfig(benchmark="SPY"))
    assert feats.empty


def test_momentum_features_handles_sparse_calendar_gaps():
    # Use more periods to ensure enough actual trading days after gaps
    idx = pd.bdate_range("2022-01-02", periods=400)

    close_spy = pd.Series(range(100, 500), index=idx, dtype=float)
    close_aaa = close_spy * 1.20
    close_bbb = pd.Series(200.0, index=idx, dtype=float)

    def mk(close):
        open_ = close * 0.99
        high = close * 1.01
        low = close * 0.98
        vol = pd.Series(1_000_000, index=close.index, dtype=float)
        return open_, high, low, close, vol

    o_s, h_s, l_s, c_s, v_s = mk(close_spy)
    o_a, h_a, l_a, c_a, v_a = mk(close_aaa)
    o_b, h_b, l_b, c_b, v_b = mk(close_bbb)

    data = {}
    for field, s_spy, s_aaa, s_bbb in [
        ("Open", o_s, o_a, o_b),
        ("High", h_s, h_a, h_b),
        ("Low", l_s, l_a, l_b),
        ("Close", c_s, c_a, c_b),
        ("Volume", v_s, v_a, v_b),
    ]:
        data[(field, "SPY")] = s_spy
        data[(field, "AAA")] = s_aaa
        data[(field, "BBB")] = s_bbb

    ohlcv = pd.DataFrame(data, index=idx)
    ohlcv.columns = pd.MultiIndex.from_tuples(ohlcv.columns)

    # Simulate sparse calendars: EUR vs USD holidays
    # Remove every 9th bar for SPY (USD), every 11th for AAA (EUR-like)
    for field in ["Open", "High", "Low", "Close", "Volume"]:
        ohlcv.loc[ohlcv.index[::9], (field, "SPY")] = float("nan")
        ohlcv.loc[ohlcv.index[::11], (field, "AAA")] = float("nan")

    feats = compute_momentum_features(ohlcv, MomentumConfig(benchmark="SPY"))

    # Both AAA and SPY should have features despite gaps
    assert "AAA" in feats.index
    assert pd.notna(feats.loc["AAA", "mom_6m"])
