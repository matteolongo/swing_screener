import pandas as pd

from swing_screener.screeners.universe import (
    apply_universe_filters,
    build_feature_table,
    build_universe,
    eligible_universe,
    UniverseConfig,
    UniverseFilterConfig,
)
from swing_screener.indicators.trend import TrendConfig
from swing_screener.indicators.volatility import VolatilityConfig
from swing_screener.indicators.momentum import MomentumConfig


def _make_synthetic_ohlcv_universe():
    idx = pd.bdate_range("2023-01-02", periods=260)

    # SPY baseline uptrend
    close_spy = pd.Series(range(100, 360), index=idx, dtype=float)

    # AAA: outperforms SPY, uptrend, moderate ranges
    close_aaa = close_spy * 1.15

    # BBB: downtrend
    close_bbb = pd.Series(range(360, 100, -1), index=idx, dtype=float)

    # CCC: uptrend but extremely volatile ranges (ATR% high)
    close_ccc = close_spy * 1.05

    def mk(close: pd.Series, range_width: float):
        open_ = close
        high = close + range_width
        low = close - range_width
        vol = pd.Series(1_000_000, index=close.index, dtype=float)
        return open_, high, low, close, vol

    # range_width affects ATR: ~ 2*range_width
    o_s, h_s, l_s, c_s, v_s = mk(close_spy, range_width=1.0)
    o_a, h_a, l_a, c_a, v_a = mk(close_aaa, range_width=1.0)
    o_b, h_b, l_b, c_b, v_b = mk(close_bbb, range_width=1.0)
    o_c, h_c, l_c, c_c, v_c = mk(close_ccc, range_width=30.0)  # very volatile

    data = {}
    for field, s_spy, s_aaa, s_bbb, s_ccc in [
        ("Open", o_s, o_a, o_b, o_c),
        ("High", h_s, h_a, h_b, h_c),
        ("Low", l_s, l_a, l_b, l_c),
        ("Close", c_s, c_a, c_b, c_c),
        ("Volume", v_s, v_a, v_b, v_c),
    ]:
        data[(field, "SPY")] = s_spy
        data[(field, "AAA")] = s_aaa
        data[(field, "BBB")] = s_bbb
        data[(field, "CCC")] = s_ccc

    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_build_feature_table_contains_expected_columns():
    ohlcv = _make_synthetic_ohlcv_universe()
    cfg = UniverseConfig(
        trend=TrendConfig(),
        vol=VolatilityConfig(atr_window=14),
        mom=MomentumConfig(benchmark="SPY"),
    )

    feats = build_feature_table(ohlcv, cfg)

    for col in ["last", "trend_ok", "atr_pct", "mom_6m", "mom_12m", "rs_6m"]:
        assert col in feats.columns

    # includes AAA/BBB/CCC (benchmark removed in momentum, but feature join is inner, so SPY stays in trend/vol
    # and will be removed only when momentum drops it; result should NOT include SPY)
    assert "AAA" in feats.index
    assert "BBB" in feats.index
    assert "CCC" in feats.index
    assert "SPY" not in feats.index


def test_build_universe_filters_expected_fail_reasons():
    ohlcv = _make_synthetic_ohlcv_universe()

    cfg = UniverseConfig(
        filt=UniverseFilterConfig(
            min_price=10,
            max_price=1000,
            max_atr_pct=10.0,  # CCC should fail due to huge ATR%
            require_trend_ok=True,  # BBB should fail due to downtrend
            require_rs_positive=False,
        )
    )

    uni = build_universe(ohlcv, cfg)

    assert "AAA" in uni.index
    assert "BBB" in uni.index
    assert "CCC" in uni.index

    assert bool(uni.loc["AAA", "is_eligible"]) is True
    assert uni.loc["AAA", "reason"] == "ok"

    assert bool(uni.loc["BBB", "is_eligible"]) is False
    assert "trend" in uni.loc["BBB", "reason"]

    assert bool(uni.loc["CCC", "is_eligible"]) is False
    assert "atr_pct" in uni.loc["CCC", "reason"]


def test_eligible_universe_returns_only_eligible():
    ohlcv = _make_synthetic_ohlcv_universe()

    cfg = UniverseConfig(
        filt=UniverseFilterConfig(
            min_price=10,
            max_price=1000,
            max_atr_pct=10.0,
            require_trend_ok=True,
        )
    )

    elig = eligible_universe(ohlcv, cfg)
    assert "AAA" in elig.index
    assert "BBB" not in elig.index
    assert "CCC" not in elig.index


def test_apply_universe_filters_currency_filter():
    feats = pd.DataFrame(
        {
            "last": [100.0, 40.0, 55.0],
            "atr_pct": [2.0, 3.0, 4.0],
            "trend_ok": [True, True, True],
            "rs_6m": [0.5, 0.4, 0.3],
        },
        index=["AAPL", "ASML.AS", "SAP.DE"],
    )
    cfg = UniverseFilterConfig(
        min_price=10.0,
        max_price=500.0,
        max_atr_pct=10.0,
        require_trend_ok=True,
        require_rs_positive=False,
        currencies=["USD"],
    )

    filtered = apply_universe_filters(feats, cfg)

    assert filtered.loc["AAPL", "currency"] == "USD"
    assert filtered.loc["ASML.AS", "currency"] == "EUR"
    assert filtered.loc["SAP.DE", "currency"] == "EUR"
    assert bool(filtered.loc["AAPL", "is_eligible"]) is True
    assert bool(filtered.loc["ASML.AS", "is_eligible"]) is False
    assert bool(filtered.loc["SAP.DE", "is_eligible"]) is False
    assert filtered.loc["ASML.AS", "reason"] == "currency"
