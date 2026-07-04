from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


StrategicStage = Literal["watching", "emerging", "active", "fading"]
StrategicActionType = Literal[
    "REVIEW_CONTEXT",
    "WAIT_FOR_CONFIRMATION",
    "TIGHTEN_RISK_REVIEW",
    "REDUCE_EXPOSURE_REVIEW",
]
StrategicDirection = Literal["bullish", "bearish", "mixed", "neutral"]
RiskMode = Literal["normal", "defensive", "aggressive"]
SourceBucket = Literal["screener_candidate", "watchlist", "open_position", "cached_intelligence"]


class StrategicSignal(BaseModel):
    title: str
    summary: str
    source: str
    timestamp: str | None = None
    url: str | None = None
    symbols: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    confidence: float = 0.5

    @field_validator("confidence")
    @classmethod
    def confidence_is_probability(cls, value: float) -> float:
        if value < 0 or value > 1:
            raise ValueError("confidence must be between 0 and 1")
        return value

    @field_validator("symbols")
    @classmethod
    def normalize_symbols(cls, values: list[str]) -> list[str]:
        return [value.strip().upper() for value in values if value.strip()]

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, values: list[str]) -> list[str]:
        return [value.strip().lower() for value in values if value.strip()]


class WatchedSymbolContext(BaseModel):
    symbol: str
    source_bucket: SourceBucket
    sector: str | None = None
    signal: str | None = None
    action: str | None = None
    conviction: str | None = None
    catalyst_urgency: str | None = None

    @field_validator("symbol")
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        return value.strip().upper()


class OpenPositionContext(BaseModel):
    symbol: str
    sector: str | None = None
    r_now: float | None = None
    days_open: int | None = None
    thesis_status: str | None = None

    @field_validator("symbol")
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        return value.strip().upper()


class MarketContext(BaseModel):
    timeframe: str = "daily"
    horizon_days: int = 10
    risk_mode: RiskMode = "normal"

    @field_validator("horizon_days")
    @classmethod
    def positive_horizon(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("horizon_days must be positive")
        return value


class StrategicIntelligenceRequest(BaseModel):
    topic: str | None = None
    signals: list[StrategicSignal] = Field(default_factory=list)
    watchlist: list[WatchedSymbolContext] = Field(default_factory=list)
    candidates: list[WatchedSymbolContext] = Field(default_factory=list)
    positions: list[OpenPositionContext] = Field(default_factory=list)
    market_context: MarketContext = Field(default_factory=MarketContext)


class StrategicPrediction(BaseModel):
    direction: StrategicDirection
    horizon_days: int
    thesis: str
    confidence: Literal["low", "medium", "high"]
    invalidation: str


class StrategicAction(BaseModel):
    action_type: StrategicActionType
    title: str
    rationale: str
    symbols: list[str] = Field(default_factory=list)


class StrategicSituation(BaseModel):
    title: str
    stage: StrategicStage
    why_now: list[str] = Field(default_factory=list)
    mechanisms: list[str] = Field(default_factory=list)
    affected_symbols: list[str] = Field(default_factory=list)
    predictions: list[StrategicPrediction] = Field(default_factory=list)
    actions: list[StrategicAction] = Field(default_factory=list)


class StrategicIntelligenceReport(BaseModel):
    generated_at: str
    input_policy: Literal["app_context_only"] = "app_context_only"
    external_source_count: int = 0
    situations: list[StrategicSituation] = Field(default_factory=list)
    memo: str
