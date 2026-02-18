"""Tests for strategy validation."""
from __future__ import annotations

from swing_screener.strategies.validation import (
    ValidationWarning,
    calculate_safety_score,
    evaluate_breakout_lookback,
    evaluate_max_atr_pct,
    evaluate_max_holding_days,
    evaluate_minimum_rr,
    evaluate_pullback_ma,
    evaluate_risk_per_trade,
    evaluate_strategy,
    get_safety_level,
    validate_strategy_full,
)


def test_evaluate_breakout_lookback() -> None:
    warning = evaluate_breakout_lookback(15)
    assert warning is not None
    assert warning.level == "danger"
    assert "day trading" in warning.message.lower()

    warning = evaluate_breakout_lookback(30)
    assert warning is not None
    assert warning.level == "warning"

    assert evaluate_breakout_lookback(50) is None


def test_evaluate_minimum_rr() -> None:
    warning = evaluate_minimum_rr(1.2)
    assert warning is not None
    assert warning.level == "danger"

    warning = evaluate_minimum_rr(1.8)
    assert warning is not None
    assert warning.level == "warning"

    assert evaluate_minimum_rr(2.5) is None


def test_evaluate_max_atr_pct() -> None:
    warning = evaluate_max_atr_pct(30)
    assert warning is not None
    assert warning.level == "danger"
    assert "extremely volatile" in warning.message.lower()

    warning = evaluate_max_atr_pct(20)
    assert warning is not None
    assert warning.level == "warning"

    assert evaluate_max_atr_pct(15) is None


def test_evaluate_pullback_ma() -> None:
    warning = evaluate_pullback_ma(8)
    assert warning is not None
    assert warning.level == "warning"

    warning = evaluate_pullback_ma(55)
    assert warning is not None
    assert warning.level == "info"

    assert evaluate_pullback_ma(20) is None


def test_evaluate_max_holding_days() -> None:
    warning = evaluate_max_holding_days(4)
    assert warning is not None
    assert warning.level == "warning"

    warning = evaluate_max_holding_days(35)
    assert warning is not None
    assert warning.level == "info"

    assert evaluate_max_holding_days(20) is None


def test_evaluate_risk_per_trade() -> None:
    warning = evaluate_risk_per_trade(4.0)
    assert warning is not None
    assert warning.level == "danger"
    assert "drawdown" in warning.message.lower()

    warning = evaluate_risk_per_trade(2.5)
    assert warning is not None
    assert warning.level == "warning"

    assert evaluate_risk_per_trade(1.5) is None


def test_evaluate_strategy_safe() -> None:
    strategy = {
        "signals": {"breakout_lookback": 50, "pullback_ma": 20},
        "risk": {"min_rr": 2.5, "risk_pct": 0.015},
        "universe": {"filt": {"max_atr_pct": 15}},
        "manage": {"max_holding_days": 20},
    }
    warnings = evaluate_strategy(strategy)
    assert warnings == []


def test_evaluate_strategy_dangerous() -> None:
    strategy = {
        "signals": {"breakout_lookback": 10, "pullback_ma": 5},
        "risk": {"min_rr": 1.2, "risk_pct": 0.04},
        "universe": {"filt": {"max_atr_pct": 30}},
        "manage": {"max_holding_days": 3},
    }
    warnings = evaluate_strategy(strategy)
    assert len(warnings) == 6
    assert sum(1 for warning in warnings if warning.level == "danger") == 4
    assert sum(1 for warning in warnings if warning.level == "warning") == 2


def test_calculate_safety_score() -> None:
    assert calculate_safety_score([]) == 100
    assert calculate_safety_score([ValidationWarning("test", "danger", "test")]) == 85

    warnings = [
        ValidationWarning("test1", "danger", "test"),
        ValidationWarning("test2", "warning", "test"),
        ValidationWarning("test3", "info", "test"),
    ]
    assert calculate_safety_score(warnings) == 74


def test_get_safety_level() -> None:
    assert get_safety_level(100) == "beginner-safe"
    assert get_safety_level(85) == "beginner-safe"
    assert get_safety_level(84) == "requires-discipline"
    assert get_safety_level(70) == "requires-discipline"
    assert get_safety_level(69) == "expert-only"
    assert get_safety_level(0) == "expert-only"


def test_validate_strategy_full() -> None:
    strategy = {
        "signals": {"breakout_lookback": 25, "pullback_ma": 20},
        "risk": {"min_rr": 2.5, "risk_pct": 0.015},
        "universe": {"filt": {"max_atr_pct": 15}},
        "manage": {"max_holding_days": 20},
    }

    warnings, score, level = validate_strategy_full(strategy)
    assert len(warnings) == 1
    assert warnings[0].level == "warning"
    assert score == 92
    assert level == "beginner-safe"


def test_validation_warning_to_dict() -> None:
    warning = ValidationWarning("testParam", "danger", "Test message")
    assert warning.to_dict() == {
        "parameter": "testParam",
        "level": "danger",
        "message": "Test message",
    }
