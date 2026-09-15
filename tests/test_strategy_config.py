import inspect

import pandas as pd

from swing_screener.execution import guidance
from swing_screener.reporting.report import build_daily_report
from swing_screener.risk.position_sizing import build_trade_plans, position_plan
from swing_screener.selection.entries import build_signal_board
from swing_screener.selection.ranking import compute_hot_score, top_candidates
from swing_screener.selection.universe import (
    apply_universe_filters,
    build_feature_table,
    build_universe,
    eligible_universe,
)
from swing_screener.strategy.config import build_report_config, build_risk_config
from swing_screener.strategy.modules.momentum import MomentumStrategyModule
from swing_screener.strategy.orchestrator import build_strategy_report
from swing_screener.strategy.report_config import ReportConfig


def test_public_pipeline_config_defaults_resolve_at_call_time() -> None:
    functions = [
        build_daily_report,
        build_strategy_report,
        MomentumStrategyModule.build_report,
        compute_hot_score,
        top_candidates,
        build_signal_board,
        build_feature_table,
        apply_universe_filters,
        build_universe,
        eligible_universe,
        position_plan,
        build_trade_plans,
        guidance.add_execution_guidance,
    ]

    for function in functions:
        assert inspect.signature(function).parameters["cfg"].default is None


def test_execution_guidance_constructs_yaml_backed_default_per_call(
    monkeypatch,
) -> None:
    constructed = []

    class RuntimeExecutionConfig:
        def __init__(self):
            constructed.append(self)

    monkeypatch.setattr(guidance, "ExecutionConfig", RuntimeExecutionConfig)

    guidance.add_execution_guidance(pd.DataFrame())

    assert len(constructed) == 1


def test_report_config_owns_a_fresh_request_scoped_execution_config() -> None:
    first = ReportConfig()
    second = ReportConfig()

    assert first.execution is not second.execution
    assert build_report_config({}).execution is not first.execution


def test_build_risk_config_ignores_account_size_mode() -> None:
    strategy = {
        "risk": {
            "account_size": 1000.0,
            "risk_pct": 0.015,
            "max_position_pct": 1.0,
            "min_shares": 1,
            "k_atr": 1.0,
            "account_size_mode": "equity",
        }
    }

    cfg = build_risk_config(strategy)

    assert cfg.account_size == 1000.0
    assert cfg.risk_pct == 0.015
    assert not hasattr(cfg, "account_size_mode")


def test_build_risk_config_exposes_explicit_portfolio_heat_limit() -> None:
    cfg = build_risk_config({"risk": {"max_portfolio_heat_pct": 0.045}})

    assert cfg.max_portfolio_heat_pct == 0.045
