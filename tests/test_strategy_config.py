import inspect

import pandas as pd
import pytest

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
from swing_screener.strategy import report_config as report_config_module
from swing_screener.strategy.config import build_report_config, build_risk_config
from swing_screener.strategy.modules.momentum import (
    MomentumStrategyModule,
    _compute_confidence,
)
from swing_screener.strategy.orchestrator import build_strategy_report
from swing_screener.strategy.report_config import ConfidenceConfig, ReportConfig


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


def test_confidence_config_changes_confidence_without_source_edits() -> None:
    report = pd.DataFrame(
        {
            "score": [0.4],
            "signal": ["breakout"],
            "dist_sma200_pct": [10.0],
            "atr_pct": [5.0],
        },
        index=["AAA"],
    )
    score_only = ConfidenceConfig(
        score_weight=1.0,
        signal_weight=0.0,
        trend_weight=0.0,
        volatility_weight=0.0,
    )
    signal_only = ConfidenceConfig(
        score_weight=0.0,
        signal_weight=1.0,
        trend_weight=0.0,
        volatility_weight=0.0,
        breakout_strength=0.7,
    )

    assert _compute_confidence(report, 10.0, score_only).iloc[0] == 40.0
    assert _compute_confidence(report, 10.0, signal_only).iloc[0] == 70.0


def test_report_config_loads_confidence_from_yaml_defaults(monkeypatch) -> None:
    class SettingsStub:
        def get_low_level_defaults_payload(self, section):
            assert section == "reporting"
            return {
                "confidence": {
                    "score_weight": 0.2,
                    "signal_weight": 0.8,
                    "trend_weight": 0.0,
                    "volatility_weight": 0.0,
                    "breakout_strength": 0.65,
                }
            }

    monkeypatch.setattr(
        report_config_module, "get_settings_manager", lambda: SettingsStub()
    )

    cfg = ReportConfig()

    assert cfg.confidence.score_weight == 0.2
    assert cfg.confidence.signal_weight == 0.8
    assert cfg.confidence.breakout_strength == 0.65


@pytest.mark.parametrize(
    "overrides",
    [
        {"score_weight": -0.1},
        {"signal_weight": float("nan")},
        {
            "score_weight": 0.0,
            "signal_weight": 0.0,
            "trend_weight": 0.0,
            "volatility_weight": 0.0,
        },
    ],
)
def test_confidence_config_rejects_invalid_weights(overrides) -> None:
    with pytest.raises(ValueError):
        ConfidenceConfig(**overrides)


def test_report_config_builder_accepts_request_scoped_overrides() -> None:
    risk = build_risk_config({"risk": {"risk_pct": 0.025}})
    cfg = build_report_config({}, top_override=24, risk_override=risk)

    assert cfg.ranking.top_n == 24
    assert cfg.risk is risk


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


def test_report_config_top_override_preserves_all_ranking_fields() -> None:
    cfg = build_report_config(
        {
            "ranking": {
                "top_n": 5,
                "w_setup_quality": 0.3,
                "extension_penalty_cap": 0.2,
            }
        },
        top_override=20,
    )

    assert cfg.ranking.top_n == 20
    assert cfg.ranking.w_setup_quality == 0.3
    assert cfg.ranking.extension_penalty_cap == 0.2
