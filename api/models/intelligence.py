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
    score_breakdown_v2: dict[str, float] = Field(default_factory=dict)
    top_catalysts: list[dict[str, str | float | int | bool]] = Field(default_factory=list)
    evidence_quality_flag: Literal["high", "medium", "low"] = "medium"


class IntelligenceOpportunitiesResponse(BaseModel):
    asof_date: str
    opportunities: list[IntelligenceOpportunityResponse] = Field(default_factory=list)


class IntelligenceEventResponse(BaseModel):
    event_id: str
    symbol: str
    event_type: str
    event_subtype: str
    timing_type: Literal["scheduled", "unscheduled"]
    materiality: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    primary_source_reliability: float = Field(ge=0, le=1)
    confirmation_count: int = Field(ge=0)
    published_at: str
    event_at: Optional[str] = None
    source_name: str
    raw_url: Optional[str] = None
    llm_fields: dict[str, str | float | int | bool] = Field(default_factory=dict)


class IntelligenceEventsResponse(BaseModel):
    asof_date: str
    events: list[IntelligenceEventResponse] = Field(default_factory=list)


class IntelligenceUpcomingCatalystResponse(BaseModel):
    symbol: str
    event_type: str
    event_subtype: str
    event_at: str
    published_at: str
    materiality: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    source_name: str
    confirmation_count: int = Field(ge=0)
    raw_url: Optional[str] = None


class IntelligenceUpcomingCatalystsResponse(BaseModel):
    asof_date: str
    days_ahead: int = Field(ge=1, le=60)
    items: list[IntelligenceUpcomingCatalystResponse] = Field(default_factory=list)


class IntelligenceSourceHealthResponse(BaseModel):
    source_name: str
    enabled: bool
    status: str
    latency_ms: float
    error_count: int
    event_count: int
    error_rate: float
    last_ingest: Optional[str] = None


class IntelligenceSourcesHealthResponse(BaseModel):
    sources: list[IntelligenceSourceHealthResponse] = Field(default_factory=list)


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
    warning: Optional[str] = None
    generated_at: str


EducationViewName = Literal["recommendation", "thesis", "learn"]
EducationSource = Literal["llm", "deterministic_fallback"]
EducationRequestSource = Literal["llm", "deterministic_fallback", "cache"]


class IntelligenceEducationError(BaseModel):
    view: EducationViewName
    code: str
    message: str
    retryable: bool = False
    provider_error_id: Optional[str] = None


class IntelligenceEducationViewOutput(BaseModel):
    title: str
    summary: str
    bullets: list[str] = Field(default_factory=list, max_length=5)
    watchouts: list[str] = Field(default_factory=list, max_length=5)
    next_steps: list[str] = Field(default_factory=list, max_length=5)
    glossary_links: list[str] = Field(default_factory=list, max_length=8)
    facts_used: list[str] = Field(default_factory=list, max_length=16)
    source: EducationSource
    template_version: str = "v1"
    generated_at: str
    debug_ref: Optional[str] = None


class IntelligenceEducationGenerateRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=16)
    asof_date: Optional[str] = None
    views: Optional[list[EducationViewName]] = None
    force_refresh: bool = False
    candidate_context: Optional[IntelligenceExplainCandidateContext] = None

    @field_validator("symbol")
    @classmethod
    def _normalize_symbol_for_education(cls, value: str) -> str:
        cleaned = str(value).strip().upper()
        if not cleaned:
            raise ValueError("symbol is required")
        return cleaned

    @field_validator("views")
    @classmethod
    def _normalize_views(cls, values: Optional[list[EducationViewName]]) -> Optional[list[EducationViewName]]:
        if values is None:
            return None
        allowed_views = {"recommendation", "thesis", "learn"}
        seen: set[str] = set()
        normalized: list[EducationViewName] = []
        invalid: list[str] = []
        for raw in values:
            view = str(raw).strip().lower()
            if not view:
                continue
            if view not in allowed_views:
                invalid.append(view)
                continue
            if view in seen:
                continue
            seen.add(view)
            normalized.append(view)  # type: ignore[arg-type]
        if invalid:
            invalid_str = ", ".join(sorted(set(invalid)))
            allowed_str = ", ".join(sorted(allowed_views))
            raise ValueError(f"Unsupported education view(s): {invalid_str}. Allowed values: {allowed_str}")
        if not normalized:
            allowed_str = ", ".join(sorted(allowed_views))
            raise ValueError(f"No valid education views requested. Allowed values: {allowed_str}")
        return normalized


class IntelligenceEducationGenerateResponse(BaseModel):
    symbol: str
    asof_date: str
    generated_at: str
    outputs: dict[EducationViewName, IntelligenceEducationViewOutput] = Field(default_factory=dict)
    status: Literal["ok", "partial", "error"]
    source: EducationRequestSource
    template_version: str = "v1"
    deterministic_facts: dict[str, str] = Field(default_factory=dict)
    errors: list[IntelligenceEducationError] = Field(default_factory=list)


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
