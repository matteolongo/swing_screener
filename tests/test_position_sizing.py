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


def test_position_plan_none_when_too_volatile():
    cfg = RiskConfig(account_size=500, risk_pct=0.01, k_atr=2.0, max_position_pct=0.60)
    # ATR huge -> risk/share too high for 5€ risk budget
    plan = position_plan(entry=30.0, atr14=10.0, cfg=cfg)
    assert plan is None


def test_build_trade_plans_filters_none_and_requires_signal():
    ranked = pd.DataFrame(
        {"atr14": [1.2, 10.0], "last": [30.0, 30.0]},
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


def test_build_trade_plans_infers_atr_column():
    ranked = pd.DataFrame(
        {"atr20": [1.2], "last": [30.0]},
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
