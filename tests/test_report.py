import pandas as pd
import json

from swing_screener.reporting.report import (
    build_daily_report,
    export_report_csv,
    today_actions,
    ReportConfig,
)
from swing_screener.selection.universe import UniverseConfig, UniverseFilterConfig
from swing_screener.risk.position_sizing import (
    RiskConfig,
    TRADE_PLAN_COLUMNS,
    build_trade_plans,
)
from swing_screener.strategy.modules.momentum import build_momentum_report


def test_build_daily_report_normalizes_direct_dataframe_input(monkeypatch):
    columns = pd.MultiIndex.from_tuples([("Close", "AAPL")])
    raw = pd.DataFrame(
        [[12.0], [10.0], [11.0]],
        index=["2026-01-03", "2026-01-01", "2026-01-03"],
        columns=columns,
    )
    captured = {}

    def fake_build_strategy_report(*, ohlcv, **kwargs):
        captured["ohlcv"] = ohlcv
        return pd.DataFrame()

    monkeypatch.setattr(
        "swing_screener.strategy.orchestrator.build_strategy_report",
        fake_build_strategy_report,
    )

    build_daily_report(raw)

    normalized = captured["ohlcv"]
    assert normalized.index.tolist() == [
        pd.Timestamp("2026-01-01"),
        pd.Timestamp("2026-01-03"),
    ]
    assert normalized.iloc[-1, 0] == 11.0


def _make_ohlcv_for_report():
    idx = pd.bdate_range("2023-01-02", periods=260)

    # SPY baseline uptrend
    close_spy = pd.Series(range(100, 360), index=idx, dtype=float)

    # AAPL breakout on last day (flat then spike)
    close_aaa = pd.Series(100.0, index=idx, dtype=float)
    close_aaa.iloc[-60:-1] = 120.0
    close_aaa.iloc[-1] = 160.0  # breakout

    # MSFT pullback reclaim (dip then reclaim)
    close_bbb = pd.Series(120.0, index=idx, dtype=float)
    close_bbb.iloc[-30:-2] = 120.0
    close_bbb.iloc[-2] = 90.0
    close_bbb.iloc[-1] = 130.0

    # NVDA high volatility -> should be filtered by atr_pct
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
        data[(field, "AAPL")] = s_a
        data[(field, "MSFT")] = s_b
        data[(field, "NVDA")] = s_c

    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def _make_liquidity_ohlcv_for_report():
    idx = pd.bdate_range("2023-01-02", periods=260)
    close_spy = pd.Series(range(100, 360), index=idx, dtype=float)
    close_liquid = pd.Series(20.0, index=idx, dtype=float)
    close_illiquid = pd.Series(20.0, index=idx, dtype=float)

    def mk(close: pd.Series, volume: float):
        open_ = close
        high = close + 1.0
        low = close - 1.0
        vol = pd.Series(volume, index=close.index, dtype=float)
        return open_, high, low, close, vol

    o_s, h_s, l_s, c_s, v_s = mk(close_spy, 1_000_000)
    o_l, h_l, l_l, c_l, v_l = mk(close_liquid, 100_000)
    o_i, h_i, l_i, c_i, v_i = mk(close_illiquid, 1_000)

    data = {}
    for field, s_s, s_l, s_i in [
        ("Open", o_s, o_l, o_i),
        ("High", h_s, h_l, h_i),
        ("Low", l_s, l_l, l_i),
        ("Close", c_s, c_l, c_i),
        ("Volume", v_s, v_l, v_i),
    ]:
        data[(field, "SPY")] = s_s
        data[(field, "LIQUID.AS")] = s_l
        data[(field, "ILLIQUID.AS")] = s_i

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
                min_avg_daily_volume_eur=0.0,
            )
        ),
        risk=RiskConfig(
            account_size=500, risk_pct=0.01, k_atr=2.0, max_position_pct=0.60
        ),
    )

    rep = build_daily_report(ohlcv, cfg)

    assert isinstance(rep, pd.DataFrame)
    assert not rep.empty

    # NVDA filtered out
    assert "NVDA" not in rep.index

    # report has key columns
    for col in ["score", "rank", "last", "signal", "confidence"]:
        assert col in rep.columns

    # should contain AAPL and MSFT
    assert "AAPL" in rep.index
    assert "MSFT" in rep.index

    # confidence only for active signals (AAPL/MSFT should be active in this fixture)
    assert pd.notna(rep.loc["AAPL", "confidence"])
    assert pd.notna(rep.loc["MSFT", "confidence"])
    assert 0 <= float(rep.loc["AAPL", "confidence"]) <= 100
    assert 0 <= float(rep.loc["MSFT", "confidence"]) <= 100


def test_build_daily_report_applies_liquidity_filter_before_ranking():
    ohlcv = _make_liquidity_ohlcv_for_report()
    cfg = ReportConfig(
        universe=UniverseConfig(
            filt=UniverseFilterConfig(
                min_price=1,
                max_price=1000,
                max_atr_pct=100.0,
                require_trend_ok=False,
                min_avg_daily_volume_eur=1_000_000.0,
            )
        )
    )

    rep = build_daily_report(ohlcv, cfg)

    assert "LIQUID.AS" in rep.index
    assert "ILLIQUID.AS" not in rep.index


def test_build_momentum_report_passes_account_to_quote_rates_into_trade_plans():
    records = pd.DataFrame(
        {
            "mom_6m": [0.30],
            "mom_12m": [0.40],
            "rs_6m": [0.20],
            "atr14": [2.0],
            "atr_pct": [2.0],
            "last": [100.0],
            "currency": ["USD"],
            "dist_sma50_pct": [5.0],
            "dist_sma200_pct": [10.0],
            "trend_ok": [True],
            "is_eligible": [True],
            "signal": ["breakout"],
            "__feature_cols__": [
                json.dumps(["mom_6m", "mom_12m", "rs_6m", "atr14", "atr_pct", "last"])
            ],
        },
        index=["AAPL"],
    )
    cfg = ReportConfig(
        universe=UniverseConfig(
            filt=UniverseFilterConfig(
                min_price=10,
                max_price=1000,
                max_atr_pct=10.0,
                require_trend_ok=False,
                min_avg_daily_volume_eur=0.0,
            )
        ),
        risk=RiskConfig(
            account_size=1000.0,
            account_currency="EUR",
            risk_pct=0.01,
            k_atr=1.0,
            max_position_pct=1.0,
        ),
    )

    report = build_momentum_report(
        pd.DataFrame(),
        cfg,
        records=records,
        account_to_quote_rates={"USD": 1.25},
    )

    assert report.loc["AAPL", "shares"] == 6
    assert report.loc["AAPL", "account_to_quote_rate"] == 1.25
    assert report.loc["AAPL", "realized_risk"] == 12.0
    assert report.loc["AAPL", "realized_risk_account"] == 9.6


def test_build_momentum_report_omits_trade_plan_when_fx_rate_missing():
    records = pd.DataFrame(
        {
            "mom_6m": [0.30],
            "mom_12m": [0.40],
            "rs_6m": [0.20],
            "atr14": [2.0],
            "atr_pct": [2.0],
            "last": [100.0],
            "currency": ["USD"],
            "dist_sma50_pct": [5.0],
            "dist_sma200_pct": [10.0],
            "trend_ok": [True],
            "is_eligible": [True],
            "signal": ["breakout"],
            "__feature_cols__": [
                json.dumps(["mom_6m", "mom_12m", "rs_6m", "atr14", "atr_pct", "last"])
            ],
        },
        index=["AAPL"],
    )
    cfg = ReportConfig(
        universe=UniverseConfig(
            filt=UniverseFilterConfig(
                min_price=10,
                max_price=1000,
                max_atr_pct=10.0,
                require_trend_ok=False,
                min_avg_daily_volume_eur=0.0,
            )
        ),
        risk=RiskConfig(
            account_size=1000.0,
            account_currency="EUR",
            risk_pct=0.01,
            k_atr=1.0,
            max_position_pct=1.0,
        ),
    )

    report = build_momentum_report(pd.DataFrame(), cfg, records=records)

    assert "AAPL" in report.index
    assert report.loc["AAPL", "plan_status"] == "blocked"
    assert report.loc["AAPL", "block_reason"] == "fx_rate_missing"
    assert pd.isna(report.loc["AAPL", "shares"])


def test_trade_plan_schema_is_stable_for_empty_and_blocked_inputs():
    empty = build_trade_plans(pd.DataFrame(), pd.DataFrame())
    assert list(empty.columns) == list(TRADE_PLAN_COLUMNS)

    ranked = pd.DataFrame(
        {"atr14": [2.0], "last": [100.0], "currency": ["USD"]}, index=["AAPL"]
    )
    board = pd.DataFrame({"signal": ["breakout"], "last": [100.0]}, index=["AAPL"])
    blocked = build_trade_plans(ranked, board, RiskConfig(account_currency="EUR"))
    assert list(blocked.columns) == list(TRADE_PLAN_COLUMNS)
    assert blocked.loc["AAPL", "plan_status"] == "blocked"
    assert blocked.loc["AAPL", "block_reason"] == "fx_rate_missing"


def test_empty_and_blocked_trade_plans_are_exportable_and_non_actionable(tmp_path):
    empty = build_trade_plans(pd.DataFrame(), pd.DataFrame())
    path = export_report_csv(empty, str(tmp_path / "empty.csv"))
    exported = pd.read_csv(path)
    assert list(exported.columns) == ["ticker", *TRADE_PLAN_COLUMNS]
    assert today_actions(empty) == "No candidates. Today: no trade."

    ranked = pd.DataFrame(
        {"atr14": [2.0], "last": [100.0], "currency": ["USD"]}, index=["AAPL"]
    )
    board = pd.DataFrame({"signal": ["breakout"], "last": [100.0]}, index=["AAPL"])
    blocked = build_trade_plans(ranked, board, RiskConfig(account_currency="EUR"))
    assert "Today: no trade." in today_actions(blocked)


def test_build_daily_report_keeps_weekly_trend_column():
    ohlcv = _make_ohlcv_for_report()

    cfg = ReportConfig(
        universe=UniverseConfig(
            filt=UniverseFilterConfig(
                min_price=10,
                max_price=1000,
                max_atr_pct=10.0,
                require_trend_ok=False,
                min_avg_daily_volume_eur=0.0,
            )
        )
    )

    rep = build_daily_report(ohlcv, cfg)

    assert "weekly_trend" in rep.columns
    assert set(rep["weekly_trend"].dropna().unique()) <= {"up", "down", "neutral"}


def test_build_daily_report_excludes_open_positions():
    ohlcv = _make_ohlcv_for_report()

    cfg = ReportConfig(
        universe=UniverseConfig(
            filt=UniverseFilterConfig(
                min_price=10,
                max_price=1000,
                max_atr_pct=10.0,
                require_trend_ok=False,
                min_avg_daily_volume_eur=0.0,
            )
        )
    )

    rep = build_daily_report(ohlcv, cfg, exclude_tickers=["AAPL"])

    assert "AAPL" not in rep.index
    assert "MSFT" in rep.index


def test_ranking_input_is_subset_of_feature_columns():
    """Guard: ranking must run only on universe feature-table columns.

    Converts the latent "a new board/setup column silently leaks into ranking
    and drifts scores" failure mode into a hard test failure.
    """
    import json

    from swing_screener.strategy.modules.momentum import (
        _FEATURE_COLS_MARKER,
        _ranking_input,
        compute_symbol_records,
    )
    from swing_screener.selection.universe import build_universe

    ohlcv = _make_ohlcv_for_report()
    cfg = ReportConfig(
        universe=UniverseConfig(
            filt=UniverseFilterConfig(
                min_price=10,
                max_price=1000,
                max_atr_pct=10.0,
                require_trend_ok=False,
                min_avg_daily_volume_eur=0.0,
            )
        )
    )

    feature_cols = set(build_universe(ohlcv, cfg.universe).columns)
    records = compute_symbol_records(ohlcv, cfg)
    assert _FEATURE_COLS_MARKER in records.columns
    assert set(json.loads(records[_FEATURE_COLS_MARKER].iloc[0])) == feature_cols

    rank_input = _ranking_input(records)
    assert set(rank_input.columns) <= feature_cols
    assert _FEATURE_COLS_MARKER not in rank_input.columns

    # A future board/setup column with a brand-new name must NOT leak in.
    poisoned = records.copy()
    poisoned["brand_new_setup_metric"] = 1.0
    assert "brand_new_setup_metric" not in _ranking_input(poisoned).columns
