"""Recommendation models."""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


RecommendationVerdict = Literal["RECOMMENDED", "NOT_RECOMMENDED"]
DecisionGateStatus = Literal["PASS", "WAIT", "BLOCK", "UNKNOWN"]
ReasonSeverity = Literal["info", "warn", "block"]


class RecommendationReason(BaseModel):
    code: str
    message: str
    severity: ReasonSeverity
    rule: Optional[str] = None
    metrics: dict[str, float | int | str] = Field(default_factory=dict)


class RecommendationRisk(BaseModel):
    entry: float
    stop: Optional[float] = None
    target: Optional[float] = None
    desired_target: Optional[float] = None
    target_source: str = "unvalidated_r_multiple"
    rr: Optional[float] = None
    risk_amount: float
    risk_amount_account: Optional[float] = Field(
        default=None,
        description="Realized risk converted to account currency",
    )
    risk_pct: float
    position_size: float
    position_size_account: Optional[float] = Field(
        default=None,
        description="Position notional converted to account currency",
    )
    shares: int
    invalidation_level: Optional[float] = None
    currency: Optional[str] = Field(
        default=None,
        description="Currency of risk_amount and position_size",
    )
    account_currency: Optional[str] = Field(
        default=None,
        description="Configured account base currency used for risk_pct denominator",
    )
    account_to_quote_rate: Optional[float] = Field(
        default=None,
        description="Quote currency units per one account currency unit",
    )


class RecommendationCosts(BaseModel):
    commission_estimate: float
    fx_estimate: float
    slippage_estimate: float
    total_cost: float
    fee_to_risk_pct: Optional[float] = None


class ChecklistGate(BaseModel):
    gate_name: str
    passed: bool
    explanation: str
    rule: Optional[str] = None


class DecisionGateModel(BaseModel):
    status: DecisionGateStatus
    explanation: str


class DecisionGateStateModel(BaseModel):
    setup: DecisionGateModel
    trigger: DecisionGateModel
    plan: DecisionGateModel
    portfolio: DecisionGateModel
    ready_to_order: bool = False


def _unknown_decision_gates() -> DecisionGateStateModel:
    unknown = lambda text: DecisionGateModel(status="UNKNOWN", explanation=text)
    return DecisionGateStateModel(
        setup=unknown("Setup gate was not evaluated."),
        trigger=unknown("Trigger gate was not evaluated."),
        plan=unknown("Plan gate was not evaluated."),
        portfolio=unknown("Portfolio gate was not evaluated."),
    )


class RecommendationEducation(BaseModel):
    common_bias_warning: str
    what_to_learn: str
    what_would_make_valid: list[str] = Field(default_factory=list)


class Recommendation(BaseModel):
    verdict: RecommendationVerdict
    reasons_short: list[str]
    reasons_detailed: list[RecommendationReason]
    risk: RecommendationRisk
    costs: RecommendationCosts
    checklist: list[ChecklistGate]
    decision_gates: DecisionGateStateModel = Field(default_factory=_unknown_decision_gates)
    education: RecommendationEducation
    thesis: Optional[dict] = None  # Trade Thesis (structured explanation, includes beginner_explanation + education_generated)
