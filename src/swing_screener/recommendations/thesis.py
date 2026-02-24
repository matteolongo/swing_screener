"""Compatibility shim for legacy imports.

Use `swing_screener.risk.recommendations.thesis` as canonical import path.
"""

from swing_screener.risk.recommendations.thesis import (
    InvalidationRule,
    SafetyLabel,
    SetupQuality,
    StructuredExplanation,
    TradePersonality,
    TradePersonalityRating,
    TradeThesis,
    build_trade_thesis,
    calculate_setup_score,
    classify_price_action,
    classify_relative_strength,
    classify_trend_strength,
    classify_volatility,
    create_trade_personality,
    determine_safety_label,
    generate_invalidation_rules,
    generate_structured_explanation,
    get_setup_quality_tier,
    thesis_to_dict,
)

__all__ = [
    "InvalidationRule",
    "SafetyLabel",
    "SetupQuality",
    "StructuredExplanation",
    "TradePersonality",
    "TradePersonalityRating",
    "TradeThesis",
    "build_trade_thesis",
    "calculate_setup_score",
    "classify_price_action",
    "classify_relative_strength",
    "classify_trend_strength",
    "classify_volatility",
    "create_trade_personality",
    "determine_safety_label",
    "generate_invalidation_rules",
    "generate_structured_explanation",
    "get_setup_quality_tier",
    "thesis_to_dict",
]
