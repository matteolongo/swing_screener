import pandas as pd

from swing_screener.risk.position_sizing import (
    position_plan,
    RiskConfig,
    build_trade_plans,
)


def test_position_plan_returns_plan():
    cfg = RiskConfig(account_size=500, risk_pct=0.01, k_atr=2.0, max_position_pct=0.60)
    plan = position_plan(entry=30.0, atr14=1.2, cfg=cfg)

    assert plan is not None
    assert plan["shares"] >= 1
    assert plan["stop"] < plan["entry"]
    assert plan["position_value"] <= cfg.account_size * cfg.max_position_pct + 1e-9


def test_position_plan_converts_account_budget_to_quote_currency():
    cfg = RiskConfig(
        account_size=1000,
        risk_pct=0.01,
        k_atr=1.0,
        max_position_pct=1.0,
        account_currency="EUR",
    )

    plan = position_plan(
        entry=100.0,
        atr14=2.0,
        cfg=cfg,
        quote_currency="USD",
        account_to_quote_rate=1.25,
    )

    assert plan is not None
    assert plan["shares"] == 6
    assert plan["account_currency"] == "EUR"
    assert plan["quote_currency"] == "USD"
    assert plan["account_to_quote_rate"] == 1.25
    assert plan["risk_amount_target_account"] == 10.0
    assert plan["risk_amount_target"] == 12.5
    assert plan["realized_risk"] == 12.0
    assert plan["realized_risk_account"] == 9.6
    assert plan["position_value"] == 600.0
    assert plan["position_value_account"] == 480.0


def test_position_plan_uses_identity_rate_for_same_currency():
    cfg = RiskConfig(
        account_size=1000,
        risk_pct=0.01,
        k_atr=1.0,
        max_position_pct=1.0,
        account_currency="EUR",
    )

    plan = position_plan(
        entry=100.0,
        atr14=2.0,
        cfg=cfg,
        quote_currency="EUR",
        account_to_quote_rate=1.25,
    )

    assert plan is not None
    assert plan["shares"] == 5
    assert plan["account_to_quote_rate"] == 1.0
    assert plan["realized_risk"] == 10.0
    assert plan["realized_risk_account"] == 10.0
    assert plan["position_value_account"] == 500.0


def test_position_plan_returns_none_for_unknown_quote_currency():
    cfg = RiskConfig(
        account_size=1000,
        risk_pct=0.01,
        k_atr=1.0,
        max_position_pct=1.0,
        account_currency="EUR",
    )

    plan = position_plan(
        entry=100.0,
        atr14=2.0,
        cfg=cfg,
        quote_currency="UNKNOWN",
    )

    assert plan is None


def test_position_plan_none_when_too_volatile():
    cfg = RiskConfig(account_size=500, risk_pct=0.01, k_atr=2.0, max_position_pct=0.60)
    # ATR huge -> risk/share too high for 5€ risk budget
    plan = position_plan(entry=30.0, atr14=10.0, cfg=cfg)
    assert plan is None


def test_build_trade_plans_filters_none_and_requires_signal():
    ranked = pd.DataFrame(
        {"atr14": [1.2, 10.0], "last": [30.0, 30.0], "currency": ["EUR", "EUR"]},
        index=["AAA", "BBB"],
    )

    signals = pd.DataFrame(
        {"last": [30.0, 30.0], "signal": ["breakout", "breakout"]},
        index=["AAA", "BBB"],
    )

    cfg = RiskConfig(account_size=500, risk_pct=0.01, k_atr=2.0, max_position_pct=0.60)

    plans = build_trade_plans(ranked, signals, cfg)

    assert "AAA" in plans.index
    assert "BBB" not in plans.index  # too volatile -> None
    assert plans.loc["AAA", "shares"] >= 1


def test_build_trade_plans_skips_missing_quote_currency():
    ranked = pd.DataFrame(
        {"atr14": [1.2], "last": [30.0]},
        index=["AAA"],
    )
    signals = pd.DataFrame(
        {"last": [30.0], "signal": ["breakout"]},
        index=["AAA"],
    )
    cfg = RiskConfig(
        account_size=500,
        risk_pct=0.01,
        k_atr=2.0,
        max_position_pct=0.60,
        account_currency="EUR",
    )

    plans = build_trade_plans(ranked, signals, cfg)

    assert plans.empty


def test_build_trade_plans_skips_unknown_quote_currency():
    ranked = pd.DataFrame(
        {"atr14": [2.0], "last": [100.0], "currency": ["UNKNOWN"]},
        index=["AAA"],
    )
    signals = pd.DataFrame(
        {"last": [100.0], "signal": ["breakout"]},
        index=["AAA"],
    )
    cfg = RiskConfig(
        account_size=1000,
        risk_pct=0.01,
        k_atr=1.0,
        max_position_pct=1.0,
        account_currency="EUR",
    )

    plans = build_trade_plans(ranked, signals, cfg)

    assert plans.empty


def test_build_trade_plans_skips_cross_currency_when_rate_missing():
    ranked = pd.DataFrame(
        {"atr14": [2.0], "last": [100.0], "currency": ["USD"]},
        index=["AAPL"],
    )
    signals = pd.DataFrame(
        {"last": [100.0], "signal": ["breakout"]},
        index=["AAPL"],
    )
    cfg = RiskConfig(
        account_size=1000,
        risk_pct=0.01,
        k_atr=1.0,
        max_position_pct=1.0,
        account_currency="EUR",
    )

    plans = build_trade_plans(ranked, signals, cfg)

    assert plans.empty


def test_build_trade_plans_infers_atr_column():
    ranked = pd.DataFrame(
        {"atr20": [1.2], "last": [30.0], "currency": ["EUR"]},
        index=["AAA"],
    )
    signals = pd.DataFrame(
        {"last": [30.0], "signal": ["breakout"]},
        index=["AAA"],
    )
    cfg = RiskConfig(account_size=500, risk_pct=0.01, k_atr=2.0, max_position_pct=0.60)

    plans = build_trade_plans(ranked, signals, cfg)

    assert "AAA" in plans.index
    assert plans.loc["AAA", "shares"] >= 1


def test_build_trade_plans_uses_row_currency_conversion_rates():
    ranked = pd.DataFrame(
        {"atr14": [2.0], "last": [100.0], "currency": ["USD"]},
        index=["AAPL"],
    )
    signals = pd.DataFrame(
        {"last": [100.0], "signal": ["breakout"]},
        index=["AAPL"],
    )
    cfg = RiskConfig(
        account_size=1000,
        risk_pct=0.01,
        k_atr=1.0,
        max_position_pct=1.0,
        account_currency="EUR",
    )

    plans = build_trade_plans(
        ranked,
        signals,
        cfg,
        account_to_quote_rates={"USD": 1.25},
    )

    assert plans.loc["AAPL", "shares"] == 6
    assert plans.loc["AAPL", "quote_currency"] == "USD"
    assert plans.loc["AAPL", "account_currency"] == "EUR"
    assert plans.loc["AAPL", "account_to_quote_rate"] == 1.25
    assert plans.loc["AAPL", "realized_risk_account"] == 9.6
