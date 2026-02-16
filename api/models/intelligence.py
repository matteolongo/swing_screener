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


# LLM Classification Models

class LLMClassifyNewsRequest(BaseModel):
    """Request to classify news headlines using LLM."""
    headlines: list[dict[str, str]] = Field(
        min_length=1,
        max_length=100,
        description="List of news items with 'headline' and optional 'snippet' fields"
    )
    provider: Optional[str] = Field(
        default="ollama",
        description="LLM provider (ollama, mock)"
    )
    model: Optional[str] = Field(
        default="mistral:7b-instruct",
        description="Model name for the provider"
    )

    @field_validator("headlines")
    @classmethod
    def _validate_headlines(cls, values: list[dict]) -> list[dict]:
        validated = []
        for item in values:
            if not isinstance(item, dict):
                raise ValueError("Each headline must be a dictionary")
            if "headline" not in item:
                raise ValueError("Each item must have a 'headline' field")
            if not isinstance(item["headline"], str) or len(item["headline"]) < 10:
                raise ValueError("Headline must be a string with at least 10 characters")
            validated.append({
                "headline": item["headline"],
                "snippet": item.get("snippet", ""),
            })
        return validated


class LLMEventClassificationResponse(BaseModel):
    """Single classified event response."""
    headline: str
    snippet: Optional[str]
    event_type: str
    severity: str
    primary_symbol: Optional[str]
    secondary_symbols: list[str]
    is_material: bool
    confidence: float
    summary: str
    model: str
    processing_time_ms: float
    cached: bool


class LLMClassifyNewsResponse(BaseModel):
    """Response with classified news events."""
    total: int
    classifications: list[LLMEventClassificationResponse]
    avg_processing_time_ms: float
    cached_count: int
    material_count: int
    provider_available: bool


