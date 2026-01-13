import pandas as pd

from swing_screener.reporting.report import build_daily_report, ReportConfig
from swing_screener.screeners.universe import UniverseConfig, UniverseFilterConfig
from swing_screener.risk.position_sizing import RiskConfig
from swing_screener.portfolio.state import Position, evaluate_positions, ManageConfig
from swing_screener.portfolio.state import render_degiro_actions_md


def _make_ohlcv_for_ui_smoke():
    idx = pd.bdate_range("2023-01-02", periods=260)

    close_spy = pd.Series(range(100, 360), index=idx, dtype=float)
    close_aaa = close_spy * 1.10

    def mk(close: pd.Series):
        open_ = close
        high = close + 1.0
        low = close - 1.0
        vol = pd.Series(1_000_000, index=close.index, dtype=float)
        return open_, high, low, close, vol

    o_s, h_s, l_s, c_s, v_s = mk(close_spy)
    o_a, h_a, l_a, c_a, v_a = mk(close_aaa)

    data = {}
    for field, s_spy, s_aaa in [
        ("Open", o_s, o_a),
        ("High", h_s, h_a),
        ("Low", l_s, l_a),
        ("Close", c_s, c_a),
        ("Volume", v_s, v_a),
    ]:
        data[(field, "SPY")] = s_spy
        data[(field, "AAA")] = s_aaa

    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_ui_smoke_pipeline():
    ohlcv = _make_ohlcv_for_ui_smoke()

    rep_cfg = ReportConfig(
        universe=UniverseConfig(
            filt=UniverseFilterConfig(
                min_price=10,
                max_price=1000,
                max_atr_pct=10.0,
                require_trend_ok=False,
            )
        ),
        risk=RiskConfig(
            account_size=500,
            risk_pct=0.01,
            k_atr=2.0,
            max_position_pct=0.60,
        ),
    )
    report = build_daily_report(ohlcv, rep_cfg)
    assert isinstance(report, pd.DataFrame)
    assert not report.empty

    entry_date = str(ohlcv.index[-10].date())
    pos = Position(
        ticker="AAA",
        status="open",
        entry_date=entry_date,
        entry_price=float(ohlcv["Close"]["AAA"].iloc[-10]),
        stop_price=float(ohlcv["Close"]["AAA"].iloc[-10]) - 5.0,
        shares=10,
    )

    updates, _ = evaluate_positions(ohlcv, [pos], ManageConfig())
    assert updates

    md = render_degiro_actions_md(updates)
    assert "# Degiro Actions" in md
    assert "## 1) MOVE STOP" in md
    assert "## 2) CLOSE" in md
    assert "## 3) NO ACTION" in md
