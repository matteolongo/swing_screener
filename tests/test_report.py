import pandas as pd

from swing_screener.reporting.report import build_daily_report, ReportConfig
from swing_screener.screeners.universe import UniverseConfig, UniverseFilterConfig
from swing_screener.risk.position_sizing import RiskConfig


def _make_ohlcv_for_report():
    idx = pd.bdate_range("2023-01-02", periods=260)

    # SPY baseline uptrend
    close_spy = pd.Series(range(100, 360), index=idx, dtype=float)

    # AAA breakout on last day (flat then spike)
    close_aaa = pd.Series(100.0, index=idx, dtype=float)
    close_aaa.iloc[-60:-1] = 120.0
    close_aaa.iloc[-1] = 160.0  # breakout

    # BBB pullback reclaim (dip then reclaim)
    close_bbb = pd.Series(120.0, index=idx, dtype=float)
    close_bbb.iloc[-30:-2] = 120.0
    close_bbb.iloc[-2] = 90.0
    close_bbb.iloc[-1] = 130.0

    # CCC high volatility -> should be filtered by atr_pct
    close_ccc = close_spy * 1.05

    def mk(close: pd.Series, range_width: float):
        open_ = close
        high = close + range_width
        low = close - range_width
        vol = pd.Series(1_000_000, index=close.index, dtype=float)
        return open_, high, low, close, vol

    o_s, h_s, l_s, c_s, v_s = mk(close_spy, 1.0)
    o_a, h_a, l_a, c_a, v_a = mk(close_aaa, 1.0)
    o_b, h_b, l_b, c_b, v_b = mk(close_bbb, 1.0)
    o_c, h_c, l_c, c_c, v_c = mk(close_ccc, 30.0)  # huge ATR

    data = {}
    for field, s_s, s_a, s_b, s_c in [
        ("Open", o_s, o_a, o_b, o_c),
        ("High", h_s, h_a, h_b, h_c),
        ("Low", l_s, l_a, l_b, l_c),
        ("Close", c_s, c_a, c_b, c_c),
        ("Volume", v_s, v_a, v_b, v_c),
    ]:
        data[(field, "SPY")] = s_s
        data[(field, "AAA")] = s_a
        data[(field, "BBB")] = s_b
        data[(field, "CCC")] = s_c

    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_build_daily_report_returns_expected_structure():
    ohlcv = _make_ohlcv_for_report()

    cfg = ReportConfig(
        universe=UniverseConfig(
            filt=UniverseFilterConfig(
                min_price=10,
                max_price=1000,
                max_atr_pct=10.0,  # CCC should be filtered out
                require_trend_ok=False,  # keep simple for this test
            )
        ),
        risk=RiskConfig(
            account_size=500, risk_pct=0.01, k_atr=2.0, max_position_pct=0.60
        ),
    )

    rep = build_daily_report(ohlcv, cfg)

    assert isinstance(rep, pd.DataFrame)
    assert not rep.empty

    # CCC filtered out
    assert "CCC" not in rep.index

    # report has key columns
    for col in ["score", "rank", "last", "signal"]:
        assert col in rep.columns

    # should contain AAA and BBB
    assert "AAA" in rep.index
    assert "BBB" in rep.index
