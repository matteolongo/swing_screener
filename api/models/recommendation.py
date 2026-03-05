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


class RecommendationBeginnerExplanation(BaseModel):
    text: str
    source: Literal["llm", "deterministic_fallback"]
    model: Optional[str] = None
    generated_at: Optional[str] = None


class RecommendationGeneratedEducationError(BaseModel):
    view: Literal["recommendation", "thesis", "learn"]
    code: str
    message: str
    retryable: bool = False
    provider_error_id: Optional[str] = None


class RecommendationGeneratedEducationView(BaseModel):
    title: str
    summary: str
    bullets: list[str] = Field(default_factory=list)
    watchouts: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    glossary_links: list[str] = Field(default_factory=list)
    facts_used: list[str] = Field(default_factory=list)
    source: Literal["llm", "deterministic_fallback"]
    template_version: str = "v1"
    generated_at: str
    debug_ref: Optional[str] = None


class RecommendationGeneratedEducationPayload(BaseModel):
    recommendation: Optional[RecommendationGeneratedEducationView] = None
    thesis: Optional[RecommendationGeneratedEducationView] = None
    learn: Optional[RecommendationGeneratedEducationView] = None
    generated_at: Optional[str] = None
    status: Optional[Literal["ok", "partial", "error"]] = None
    source: Optional[Literal["llm", "deterministic_fallback", "cache"]] = None
    template_version: Optional[str] = None
    deterministic_facts: dict[str, str] = Field(default_factory=dict)
    errors: list[RecommendationGeneratedEducationError] = Field(default_factory=list)


class Recommendation(BaseModel):
    verdict: RecommendationVerdict
    reasons_short: list[str]
    reasons_detailed: list[RecommendationReason]
    risk: RecommendationRisk
    costs: RecommendationCosts
    checklist: list[ChecklistGate]
    education: RecommendationEducation
    thesis: Optional[dict] = None  # Trade Thesis (structured explanation, includes beginner_explanation + education_generated)
