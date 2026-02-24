"""Compatibility shim for legacy imports.

Use `swing_screener.strategy.validation` as canonical import path.
"""

from swing_screener.strategy.validation import (
    ValidationWarning,
    WarningLevel,
    SafetyLevel,
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

__all__ = [
    "ValidationWarning",
    "WarningLevel",
    "SafetyLevel",
    "calculate_safety_score",
    "evaluate_breakout_lookback",
    "evaluate_max_atr_pct",
    "evaluate_max_holding_days",
    "evaluate_minimum_rr",
    "evaluate_pullback_ma",
    "evaluate_risk_per_trade",
    "evaluate_strategy",
    "get_safety_level",
    "validate_strategy_full",
]
