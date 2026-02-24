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
    enable_cache: bool = True
    enable_audit: bool = True
    cache_path: str = "data/intelligence/llm_cache.json"
    audit_path: str = "data/intelligence/llm_audit"
    max_concurrency: int = Field(default=4, ge=1, le=16)


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
