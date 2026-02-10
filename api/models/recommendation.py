"""Recommendation models."""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


RecommendationVerdict = Literal["RECOMMENDED", "NOT_RECOMMENDED"]
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
    rr: Optional[float] = None
    risk_amount: float
    risk_pct: float
    position_size: float
    shares: int
    invalidation_level: Optional[float] = None


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
    education: RecommendationEducation
