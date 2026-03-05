"""Market intelligence API models."""
from __future__ import annotations

from typing import ClassVar, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator
from swing_screener.intelligence.config import SUPPORTED_INTEL_PROVIDERS


class IntelligenceRunRequest(BaseModel):
    symbols: Optional[list[str]] = Field(default=None, max_length=500)
    symbol_set_id: Optional[str] = None
    technical_readiness: Optional[dict[str, float]] = None
    providers: Optional[list[str]] = None
    lookback_hours: Optional[int] = Field(default=None, ge=1, le=240)
    max_opportunities: Optional[int] = Field(default=None, ge=1, le=20)

    @field_validator("symbols")
    @classmethod
    def _validate_symbols(cls, values: Optional[list[str]]) -> list[str]:
        if values is None:
            return []
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            symbol = str(value).strip().upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            normalized.append(symbol)
        return normalized

    @field_validator("symbol_set_id")
    @classmethod
    def _validate_symbol_set_id(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @field_validator("providers")
    @classmethod
    def _validate_providers(cls, values: Optional[list[str]]) -> Optional[list[str]]:
        if values is None:
            return None
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            provider = str(value).strip().lower()
            if not provider or provider in seen:
                continue
            if provider not in SUPPORTED_INTEL_PROVIDERS:
                allowed = ", ".join(sorted(SUPPORTED_INTEL_PROVIDERS))
                raise ValueError(f"Unsupported provider: {provider}. Allowed values: {allowed}")
            seen.add(provider)
            normalized.append(provider)
        return normalized or None

    @model_validator(mode="after")
    def _validate_scope(self) -> "IntelligenceRunRequest":
        has_symbols = bool(self.symbols)
        has_symbol_set = bool(self.symbol_set_id)
        if has_symbols == has_symbol_set:
            raise ValueError("Provide exactly one of 'symbols' or 'symbol_set_id'.")
        return self


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
    llm_warnings_count: int = 0
    llm_warning_sample: Optional[str] = None
    events_kept_count: int = 0
    events_dropped_count: int = 0
    duplicate_suppressed_count: int = 0
    analysis_summary: Optional[str] = None
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


class IntelligenceExplainCandidateContext(BaseModel):
    signal: Optional[str] = None
    entry: Optional[float] = None
    stop: Optional[float] = None
    target: Optional[float] = None
    rr: Optional[float] = None
    confidence: Optional[float] = None
    close: Optional[float] = None
    atr: Optional[float] = None
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    momentum_6m: Optional[float] = None
    momentum_12m: Optional[float] = None
    rel_strength: Optional[float] = None


class IntelligenceExplainSymbolRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=16)
    asof_date: Optional[str] = None
    candidate_context: Optional[IntelligenceExplainCandidateContext] = None

    @field_validator("symbol")
    @classmethod
    def _normalize_symbol(cls, value: str) -> str:
        cleaned = str(value).strip().upper()
        if not cleaned:
            raise ValueError("symbol is required")
        return cleaned


class IntelligenceExplainSymbolResponse(BaseModel):
    symbol: str
    asof_date: str
    explanation: str
    source: Literal["llm", "deterministic_fallback"]
    model: Optional[str] = None
    generated_at: str


# LLM Classification Models

class LLMClassifyNewsRequest(BaseModel):
    """Request to classify news headlines using LLM."""
    SUPPORTED_LLM_PROVIDERS: ClassVar[set[str]] = {"ollama", "mock", "openai"}

    headlines: list[dict[str, str]] = Field(
        min_length=1,
        max_length=100,
        description="List of news items with 'headline' and optional 'snippet' fields"
    )
    provider: Optional[str] = Field(
        default="ollama",
        description="LLM provider (ollama, mock, openai)"
    )
    model: Optional[str] = Field(
        default="mistral:7b-instruct",
        description="Model name for the provider"
    )
    base_url: Optional[str] = Field(
        default=None,
        description="Optional base URL override for provider"
    )
    api_key: Optional[str] = Field(
        default=None,
        description="Optional API key override (required for openai unless env is set)"
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

    @field_validator("provider")
    @classmethod
    def _normalize_provider(cls, value: Optional[str]) -> str:
        if value is None:
            return "ollama"
        normalized = str(value).strip().lower()
        return normalized or "ollama"


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
