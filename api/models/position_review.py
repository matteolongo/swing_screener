from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


PositionReviewMode = Literal["position", "symbol"]
SuggestedAction = Literal["HOLD", "TRIM", "EXIT", "RAISE_STOP", "WATCH"]
ThesisStatus = Literal["intact", "weakening", "broken", "unclear"]
MoveExtension = Literal["low", "medium", "high", "unknown"]
TrimAdvice = Literal["none", "trim_25_percent", "trim_33_percent", "trim_50_percent", "exit"]
StopMethod = Literal["keep", "breakeven", "trail_sma20", "trail_recent_low", "manual_review"]
MacroRiskLevel = Literal["low", "medium", "high", "unknown"]
TechnicalReliability = Literal["normal", "reduced", "unreliable", "unknown"]
AffectedTimeframe = Literal["intraday", "days", "weeks", "unknown"]


class PositionReviewRequest(BaseModel):
    refresh_sources: bool = Field(
        default=False,
        description="When true, refresh configured app evidence sources before the review.",
    )


class MoveExplanation(BaseModel):
    summary: str
    company_catalyst_weight: int = Field(ge=0, le=100)
    sector_weight: int = Field(ge=0, le=100)
    market_macro_weight: int = Field(ge=0, le=100)
    technical_weight: int = Field(ge=0, le=100)
    drivers: list[str] = Field(default_factory=list)


class ProfitProtection(BaseModel):
    current_r: float | None = None
    move_extension: MoveExtension
    trim_advice: TrimAdvice
    reason: str


class StopAdvice(BaseModel):
    current_stop: float | None = None
    suggested_stop: float | None = None
    method: StopMethod
    reason: str


class MacroOverlay(BaseModel):
    risk_level: MacroRiskLevel
    technical_reliability: TechnicalReliability
    reason: str
    affected_timeframe: AffectedTimeframe


class ReviewEvidence(BaseModel):
    label: str
    source: str | None = None
    url: str | None = None
    date: str | None = None
    summary: str | None = None
    relevance: str | None = None


class PositionReviewResponse(BaseModel):
    ticker: str
    generated_at: str
    mode: PositionReviewMode
    suggested_action: SuggestedAction
    thesis_status: ThesisStatus
    move_explanation: MoveExplanation
    profit_protection: ProfitProtection
    stop_advice: StopAdvice
    macro_overlay: MacroOverlay
    evidence_used: list[ReviewEvidence] = Field(default_factory=list)
    narrative: str
