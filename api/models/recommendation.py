"""Recommendation models."""

from __future__ import annotations

import math
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

RecommendationVerdict = Literal["RECOMMENDED", "NOT_RECOMMENDED"]
DecisionGateStatus = Literal["PASS", "WAIT", "BLOCK", "UNKNOWN"]
ReasonSeverity = Literal["info", "warn", "block"]
WorkflowStatus = Literal["ready", "waiting_trigger", "needs_review", "no_setup"]
NextStepCode = Literal[
    "review_order",
    "wait_pullback",
    "wait_breakout_close",
    "define_target",
    "refresh_data",
    "fix_stop",
    "inspect_gate_conflict",
    "observe",
]


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


class ExecutionNextStepModel(BaseModel):
    code: NextStepCode
    trigger_price: Optional[float] = None
    currency: Optional[str] = None

    @field_validator("trigger_price")
    @classmethod
    def normalize_trigger_price(cls, value: Optional[float]) -> Optional[float]:
        if value is None or not math.isfinite(value) or value <= 0:
            return None
        return value

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: Optional[str]) -> Optional[str]:
        normalized = str(value or "").strip().upper()
        valid_shape = (
            len(normalized) == 3
            and normalized.isascii()
            and normalized.isalpha()
            and normalized != "UNKNOWN"
        )
        return normalized if valid_shape else None


def _unknown_decision_gates() -> DecisionGateStateModel:
    def unknown(text: str) -> DecisionGateModel:
        return DecisionGateModel(status="UNKNOWN", explanation=text)

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
    decision_gates: DecisionGateStateModel = Field(
        default_factory=_unknown_decision_gates
    )
    workflow_status: WorkflowStatus = "needs_review"
    next_step: ExecutionNextStepModel = Field(
        default_factory=lambda: ExecutionNextStepModel(code="refresh_data")
    )
    education: RecommendationEducation
    thesis: Optional[dict] = (
        None  # Trade Thesis (structured explanation, includes beginner_explanation + education_generated)
    )

    @model_validator(mode="after")
    def normalize_execution_workflow(self) -> "Recommendation":
        step = self.next_step
        has_parameters = step.trigger_price is not None or step.currency is not None
        review_codes = {
            "define_target",
            "refresh_data",
            "fix_stop",
            "inspect_gate_conflict",
        }
        coherent = (
            (
                self.workflow_status == "ready"
                and step.code == "review_order"
                and not has_parameters
            )
            or (
                self.workflow_status == "waiting_trigger"
                and step.code in {"wait_pullback", "wait_breakout_close"}
                and step.trigger_price is not None
                and step.currency is not None
            )
            or (
                self.workflow_status == "needs_review"
                and step.code in review_codes
                and not has_parameters
            )
            or (
                self.workflow_status == "no_setup"
                and step.code == "observe"
                and not has_parameters
            )
        )
        if not coherent:
            self.workflow_status = "needs_review"
            self.next_step = ExecutionNextStepModel(code="refresh_data")
        return self
