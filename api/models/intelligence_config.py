"""Dedicated intelligence configuration and symbol-set API models."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from swing_screener.intelligence.config import SUPPORTED_INTEL_PROVIDERS


class IntelligenceLLMConfigModel(BaseModel):
    enabled: bool = False
    provider: Literal["ollama", "mock", "openai"] = "ollama"
    model: str = "mistral:7b-instruct"
    base_url: str = "http://localhost:11434"
    api_key: str = ""
    system_prompt: str = Field(default="", max_length=20000)
    user_prompt_template: str = Field(default="", max_length=40000)
    enable_cache: bool = True
    enable_audit: bool = True
    cache_path: str = "data/intelligence/llm_cache.json"
    audit_path: str = "data/intelligence/llm_audit"
    max_concurrency: int = Field(default=4, ge=1, le=16)
    education_template_version: str = Field(default="v1", max_length=64)
    education_style_level: str = Field(default="beginner", max_length=64)
    education_max_tokens: int = Field(default=450, ge=64, le=4000)
    education_forbidden_claim_categories: list[str] = Field(
        default_factory=lambda: ["prediction", "guarantee", "financial_advice"]
    )
    education_recommendation_system_prompt: str = Field(default="", max_length=20000)
    education_recommendation_user_prompt_template: str = Field(default="", max_length=40000)
    education_thesis_system_prompt: str = Field(default="", max_length=20000)
    education_thesis_user_prompt_template: str = Field(default="", max_length=40000)
    education_learn_system_prompt: str = Field(default="", max_length=20000)
    education_learn_user_prompt_template: str = Field(default="", max_length=40000)

    @field_validator(
        "system_prompt",
        "user_prompt_template",
        "education_recommendation_system_prompt",
        "education_recommendation_user_prompt_template",
        "education_thesis_system_prompt",
        "education_thesis_user_prompt_template",
        "education_learn_system_prompt",
        "education_learn_user_prompt_template",
        mode="before",
    )
    @classmethod
    def _normalize_prompt_text(cls, value: object) -> str:
        if value is None:
            return ""
        return str(value).replace("\r\n", "\n").strip()

    @field_validator("education_forbidden_claim_categories", mode="before")
    @classmethod
    def _normalize_forbidden_categories(cls, value: object) -> list[str]:
        if value is None:
            return ["prediction", "guarantee", "financial_advice"]
        if isinstance(value, str):
            raw_items = [part.strip() for part in value.split(",")]
        elif isinstance(value, (list, tuple, set)):
            raw_items = [str(part).strip() for part in value]
        else:
            raw_items = []
        normalized: list[str] = []
        seen: set[str] = set()
        for item in raw_items:
            if not item:
                continue
            key = item.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(key)
        return normalized or ["prediction", "guarantee", "financial_advice"]


class IntelligenceCatalystConfigModel(BaseModel):
    lookback_hours: int = Field(default=72, ge=1, le=240)
    recency_half_life_hours: int = Field(default=36, ge=1, le=240)
    false_catalyst_return_z: float = Field(default=1.5, ge=0)
    min_price_reaction_atr: float = Field(default=0.8, ge=0)
    require_price_confirmation: bool = True


class IntelligenceThemeConfigModel(BaseModel):
    enabled: bool = True
    min_cluster_size: int = Field(default=3, ge=1, le=100)
    min_peer_confirmation: int = Field(default=2, ge=1, le=100)
    curated_peer_map_path: str = "data/intelligence/peer_map.yaml"


class IntelligenceOpportunityConfigModel(BaseModel):
    technical_weight: float = Field(default=0.55, ge=0)
    catalyst_weight: float = Field(default=0.45, ge=0)
    max_daily_opportunities: int = Field(default=8, ge=1, le=20)
    min_opportunity_score: float = Field(default=0.55, ge=0, le=1)


class IntelligenceSourcesRateLimitModel(BaseModel):
    requests_per_minute: int = Field(default=90, ge=1, le=5000)
    max_concurrency: int = Field(default=4, ge=1, le=64)


class IntelligenceSourcesTimeoutModel(BaseModel):
    connect_seconds: float = Field(default=5.0, ge=0.1, le=120.0)
    read_seconds: float = Field(default=20.0, ge=0.1, le=300.0)


class IntelligenceSourcesConfigModel(BaseModel):
    enabled: list[str] = Field(
        default_factory=lambda: [
            "yahoo_finance",
            "earnings_calendar",
            "sec_edgar",
            "company_ir_rss",
        ]
    )
    scraping_enabled: bool = False
    allowed_domains: list[str] = Field(default_factory=list)
    rate_limits: IntelligenceSourcesRateLimitModel = Field(default_factory=IntelligenceSourcesRateLimitModel)
    timeouts: IntelligenceSourcesTimeoutModel = Field(default_factory=IntelligenceSourcesTimeoutModel)

    @field_validator("enabled")
    @classmethod
    def _normalize_enabled_sources(cls, values: list[str]) -> list[str]:
        allowed = {
            "yahoo_finance",
            "earnings_calendar",
            "sec_edgar",
            "company_ir_rss",
            "exchange_announcements",
            "financial_news_rss",
            "calendar_fallback_scrape",
        }
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            source = str(value).strip().lower()
            if not source or source in seen or source not in allowed:
                continue
            seen.add(source)
            normalized.append(source)
        return normalized or ["yahoo_finance", "earnings_calendar", "sec_edgar", "company_ir_rss"]

    @field_validator("allowed_domains")
    @classmethod
    def _normalize_allowed_domains(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            domain = str(value).strip().lower()
            if not domain or domain in seen:
                continue
            seen.add(domain)
            normalized.append(domain)
        return normalized


class IntelligenceScoringV2WeightsModel(BaseModel):
    reaction_z_component: float = Field(default=0.22, ge=0, le=1)
    atr_shock_component: float = Field(default=0.12, ge=0, le=1)
    recency_component: float = Field(default=0.14, ge=0, le=1)
    proximity_component: float = Field(default=0.14, ge=0, le=1)
    materiality_component: float = Field(default=0.14, ge=0, le=1)
    source_quality_component: float = Field(default=0.10, ge=0, le=1)
    confirmation_component: float = Field(default=0.08, ge=0, le=1)
    filing_impact_component: float = Field(default=0.06, ge=0, le=1)
    uncertainty_penalty_component: float = Field(default=0.10, ge=0, le=1)


class IntelligenceScoringV2ConfigModel(BaseModel):
    enabled: bool = True
    weights: IntelligenceScoringV2WeightsModel = Field(default_factory=IntelligenceScoringV2WeightsModel)
    low_evidence_confirmation_threshold: float = Field(default=0.25, ge=0, le=1)
    low_evidence_source_quality_threshold: float = Field(default=0.45, ge=0, le=1)
    stale_event_decay_hours: int = Field(default=120, ge=1, le=1000)


class IntelligenceCalendarConfigModel(BaseModel):
    binary_event_window_days: int = Field(default=3, ge=1, le=30)
    binary_event_min_materiality: float = Field(default=0.75, ge=0, le=1)
    binary_event_min_threshold_boost: float = Field(default=0.08, ge=0, le=1)
    low_evidence_min_threshold_boost: float = Field(default=0.06, ge=0, le=1)


class IntelligenceConfigModel(BaseModel):
    enabled: bool = False
    providers: list[str] = Field(default_factory=lambda: ["yahoo_finance"])
    universe_scope: Literal["screener_universe", "strategy_universe"] = "screener_universe"
    market_context_symbols: list[str] = Field(
        default_factory=lambda: ["SPY", "QQQ", "XLK", "SMH", "XBI"]
    )
    llm: IntelligenceLLMConfigModel = Field(default_factory=IntelligenceLLMConfigModel)
    catalyst: IntelligenceCatalystConfigModel = Field(default_factory=IntelligenceCatalystConfigModel)
    theme: IntelligenceThemeConfigModel = Field(default_factory=IntelligenceThemeConfigModel)
    opportunity: IntelligenceOpportunityConfigModel = Field(default_factory=IntelligenceOpportunityConfigModel)
    sources: IntelligenceSourcesConfigModel = Field(default_factory=IntelligenceSourcesConfigModel)
    scoring_v2: IntelligenceScoringV2ConfigModel = Field(default_factory=IntelligenceScoringV2ConfigModel)
    calendar: IntelligenceCalendarConfigModel = Field(default_factory=IntelligenceCalendarConfigModel)

    @field_validator("providers")
    @classmethod
    def _validate_providers(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            provider = str(value).strip().lower()
            if not provider or provider in seen:
                continue
            if provider not in SUPPORTED_INTEL_PROVIDERS:
                continue
            seen.add(provider)
            normalized.append(provider)
        return normalized or ["yahoo_finance"]

    @field_validator("market_context_symbols")
    @classmethod
    def _validate_market_context_symbols(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            symbol = str(value).strip().upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            normalized.append(symbol)
        return normalized or ["SPY", "QQQ", "XLK", "SMH", "XBI"]


class IntelligenceProviderInfoResponse(BaseModel):
    provider: str
    available: bool
    detail: Optional[str] = None


class IntelligenceProviderTestRequest(BaseModel):
    provider: Literal["ollama", "mock", "openai"] = "ollama"
    model: str = "mistral:7b-instruct"
    base_url: Optional[str] = None
    api_key: Optional[str] = None


class IntelligenceProviderTestResponse(BaseModel):
    provider: str
    model: str
    available: bool
    detail: Optional[str] = None


class IntelligenceSymbolSetCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    symbols: list[str] = Field(min_length=1, max_length=500)

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


class IntelligenceSymbolSetUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    symbols: list[str] = Field(min_length=1, max_length=500)

    @field_validator("symbols")
    @classmethod
    def _validate_symbols(cls, values: list[str]) -> list[str]:
        return IntelligenceSymbolSetCreateRequest._validate_symbols(values)


class IntelligenceSymbolSetResponse(BaseModel):
    id: str
    name: str
    symbols: list[str]
    created_at: str
    updated_at: str


class IntelligenceSymbolSetsResponse(BaseModel):
    items: list[IntelligenceSymbolSetResponse] = Field(default_factory=list)


class IntelligenceSymbolSetDeleteResponse(BaseModel):
    deleted: bool
    id: str


class IntelligenceRunRequestScopeModel(BaseModel):
    symbols: Optional[list[str]] = None
    symbol_set_id: Optional[str] = None

    @field_validator("symbols")
    @classmethod
    def _validate_symbols(cls, values: Optional[list[str]]) -> Optional[list[str]]:
        if values is None:
            return None
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            symbol = str(value).strip().upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            normalized.append(symbol)
        return normalized or None

    @model_validator(mode="after")
    def _validate_scope(self) -> "IntelligenceRunRequestScopeModel":
        has_symbols = bool(self.symbols)
        has_set = bool(str(self.symbol_set_id or "").strip())
        if has_symbols == has_set:
            raise ValueError("Provide exactly one of 'symbols' or 'symbol_set_id'.")
        if has_set:
            self.symbol_set_id = str(self.symbol_set_id).strip()
        return self


class IntelligenceConfigStorageEnvelope(BaseModel):
    """On-disk envelope for dedicated intelligence configuration."""

    config: IntelligenceConfigModel
    bootstrapped_from_strategy: bool = False
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().replace(microsecond=0).isoformat())
