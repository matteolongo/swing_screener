"""Strategy parameter validation and safety scoring."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

WarningLevel = Literal["danger", "warning", "info"]
SafetyLevel = Literal["beginner-safe", "requires-discipline", "expert-only"]


@dataclass(frozen=True)
class ValidationWarning:
    """Validation warning for a strategy parameter."""

    parameter: str
    level: WarningLevel
    message: str

    def to_dict(self) -> dict[str, str]:
        return {
            "parameter": self.parameter,
            "level": self.level,
            "message": self.message,
        }


def evaluate_breakout_lookback(value: int) -> ValidationWarning | None:
    if value < 20:
        return ValidationWarning(
            parameter="breakoutLookback",
            level="danger",
            message="Breakout Lookback below 20 behaves more like day trading than swing trading.",
        )
    if value < 40:
        return ValidationWarning(
            parameter="breakoutLookback",
            level="warning",
            message="Lower lookback periods increase signal frequency but may include more false breakouts.",
        )
    return None


def evaluate_minimum_rr(value: float) -> ValidationWarning | None:
    if value < 1.5:
        return ValidationWarning(
            parameter="minimumRr",
            level="danger",
            message="Minimum R/R under 1.5 makes profitability statistically harder. Consider raising to 2 or higher.",
        )
    if value < 2.0:
        return ValidationWarning(
            parameter="minimumRr",
            level="warning",
            message="R/R below 2 requires a higher win rate to be profitable. Most professionals target 2:1 or better.",
        )
    return None


def evaluate_max_atr_pct(value: float) -> ValidationWarning | None:
    if value > 25:
        return ValidationWarning(
            parameter="maxAtrPct",
            level="danger",
            message="Max ATR above 25% indicates extremely volatile stocks — beginners often struggle managing risk at this level.",
        )
    if value > 18:
        return ValidationWarning(
            parameter="maxAtrPct",
            level="warning",
            message="Higher volatility means larger stop distances and more emotional pressure. Ensure your risk management is solid.",
        )
    return None


def evaluate_pullback_ma(value: int) -> ValidationWarning | None:
    if value < 10:
        return ValidationWarning(
            parameter="pullbackMa",
            level="warning",
            message="Very short pullback periods may lead to entries on minor retracements that fail.",
        )
    if value > 50:
        return ValidationWarning(
            parameter="pullbackMa",
            level="info",
            message="Longer pullback periods are more conservative but may miss faster-moving opportunities.",
        )
    return None


def evaluate_max_holding_days(value: int) -> ValidationWarning | None:
    if value < 5:
        return ValidationWarning(
            parameter="maxHoldingDays",
            level="warning",
            message="Very short holding periods may not give momentum enough time to develop.",
        )
    if value > 30:
        return ValidationWarning(
            parameter="maxHoldingDays",
            level="info",
            message="Longer holding periods can tie up capital in stagnant trades. Monitor performance closely.",
        )
    return None


def evaluate_risk_per_trade(value_pct: float) -> ValidationWarning | None:
    if value_pct > 3:
        return ValidationWarning(
            parameter="riskPerTrade",
            level="danger",
            message="Risking more than 3% per trade significantly increases the risk of large drawdowns.",
        )
    if value_pct > 2:
        return ValidationWarning(
            parameter="riskPerTrade",
            level="warning",
            message="Most professional traders risk 1-2% per trade. Higher risk requires perfect execution.",
        )
    return None


def evaluate_strategy(strategy_dict: dict) -> list[ValidationWarning]:
    """Evaluate configured strategy parameters and return warnings."""
    warnings: list[ValidationWarning] = []

    signals = strategy_dict.get("signals", {})
    breakout = signals.get("breakout_lookback")
    if breakout is not None:
        warning = evaluate_breakout_lookback(int(breakout))
        if warning:
            warnings.append(warning)

    pullback = signals.get("pullback_ma")
    if pullback is not None:
        warning = evaluate_pullback_ma(int(pullback))
        if warning:
            warnings.append(warning)

    risk = strategy_dict.get("risk", {})
    min_rr = risk.get("min_rr")
    if min_rr is not None:
        warning = evaluate_minimum_rr(float(min_rr))
        if warning:
            warnings.append(warning)

    risk_pct = risk.get("risk_pct")
    if risk_pct is not None:
        warning = evaluate_risk_per_trade(float(risk_pct) * 100.0)
        if warning:
            warnings.append(warning)

    universe = strategy_dict.get("universe", {})
    filt = universe.get("filt", {})
    max_atr = filt.get("max_atr_pct")
    if max_atr is not None:
        warning = evaluate_max_atr_pct(float(max_atr))
        if warning:
            warnings.append(warning)

    manage = strategy_dict.get("manage", {})
    max_holding_days = manage.get("max_holding_days")
    if max_holding_days is not None:
        warning = evaluate_max_holding_days(int(max_holding_days))
        if warning:
            warnings.append(warning)

    return warnings


def calculate_safety_score(warnings: list[ValidationWarning]) -> int:
    score = 100
    for warning in warnings:
        if warning.level == "danger":
            score -= 15
        elif warning.level == "warning":
            score -= 8
        elif warning.level == "info":
            score -= 3
    return max(0, min(100, score))


def get_safety_level(score: int) -> SafetyLevel:
    if score >= 85:
        return "beginner-safe"
    if score >= 70:
        return "requires-discipline"
    return "expert-only"


def validate_strategy_full(strategy_dict: dict) -> tuple[list[ValidationWarning], int, SafetyLevel]:
    warnings = evaluate_strategy(strategy_dict)
    score = calculate_safety_score(warnings)
    level = get_safety_level(score)
    return warnings, score, level
