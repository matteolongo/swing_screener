"""Market intelligence API models."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class IntelligenceRunRequest(BaseModel):
    symbols: list[str] = Field(min_length=1, max_length=500)
    technical_readiness: Optional[dict[str, float]] = None
    providers: Optional[list[str]] = None
    lookback_hours: Optional[int] = Field(default=None, ge=1, le=240)
    max_opportunities: Optional[int] = Field(default=None, ge=1, le=20)

    @field_validator("symbols")
    @classmethod
    def _validate_symbols(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            symbol = str(value).strip().upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            normalized.append(symbol)
        if not normalized:
            raise ValueError("At least one valid symbol is required.")
        return normalized


class IntelligenceRunLaunchResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "error"]
    total_symbols: int
    created_at: str
    updated_at: str


class IntelligenceRunStatusResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "error"]
    total_symbols: int
    completed_symbols: int
    asof_date: Optional[str] = None
    opportunities_count: int = 0
    error: Optional[str] = None
    created_at: str
    updated_at: str


class IntelligenceOpportunityResponse(BaseModel):
    symbol: str
    technical_readiness: float
    catalyst_strength: float
    opportunity_score: float
    state: str
    explanations: list[str] = Field(default_factory=list)


class IntelligenceOpportunitiesResponse(BaseModel):
    asof_date: str
    opportunities: list[IntelligenceOpportunityResponse] = Field(default_factory=list)

