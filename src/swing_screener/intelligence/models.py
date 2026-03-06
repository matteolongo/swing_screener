from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Literal

SymbolLifecycleState = Literal[
    "QUIET",
    "WATCH",
    "CATALYST_ACTIVE",
    "TRENDING",
    "COOLING_OFF",
]


@dataclass(frozen=True)
class Event:
    event_id: str
    symbol: str
    source: str
    occurred_at: str
    headline: str
    event_type: str
    credibility: float
    url: str | None = None
    metadata: dict[str, str | float | int | bool] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class InstrumentProfile:
    symbol: str
    exchange_mic: str
    country_code: str
    currency: str
    timezone: str
    aliases: list[str] = field(default_factory=list)
    provider_symbol_map: dict[str, str] = field(default_factory=dict)
    resolution_source: Literal["override", "master", "heuristic"] = "heuristic"
    resolution_confidence: float = 0.5
    resolution_reason_code: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class EvidenceRecord:
    evidence_id: str
    symbol: str
    source_name: str
    source_type: Literal["official", "company", "news", "scrape", "api"]
    url: str | None
    headline: str
    body_snippet: str
    published_at: str
    event_at: str | None
    language: str = "en"
    raw_payload_ref: str | None = None
    feed_origin: Literal["discovered", "catalog", "manual"] = "manual"
    blocked_reason: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class NormalizedEvent:
    event_id: str
    symbol: str
    event_type: str
    event_subtype: str
    timing_type: Literal["scheduled", "unscheduled"]
    materiality: float
    confidence: float
    primary_source_reliability: float
    confirmation_count: int
    published_at: str
    event_at: str | None = None
    source_name: str = ""
    raw_url: str | None = None
    llm_fields: dict[str, str | float | int | bool] = field(default_factory=dict)
    dynamic_source_quality: float = 0.0
    resolution_source: str = "heuristic"
    dedupe_method: str = "url_exact"

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class CatalystFeatureVector:
    symbol: str
    proximity_score: float
    materiality_score: float
    source_quality_score: float
    confirmation_score: float
    uncertainty_penalty: float
    filing_impact_score: float
    calendar_risk_score: float
    top_catalysts: list[dict[str, str | float | int | bool]] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class CatalystSignal:
    symbol: str
    event_id: str
    return_z: float
    atr_shock: float
    peer_confirmation_count: int
    recency_hours: float
    is_false_catalyst: bool
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class ThemeCluster:
    theme_id: str
    name: str
    symbols: list[str]
    cluster_strength: float
    driver_signals: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class Opportunity:
    symbol: str
    technical_readiness: float
    catalyst_strength: float
    opportunity_score: float
    state: SymbolLifecycleState
    explanations: list[str] = field(default_factory=list)
    score_breakdown_v2: dict[str, float] = field(default_factory=dict)
    top_catalysts: list[dict[str, str | float | int | bool]] = field(default_factory=list)
    evidence_quality_flag: Literal["high", "medium", "low"] = "medium"

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class SymbolState:
    symbol: str
    state: SymbolLifecycleState
    last_transition_at: str
    state_score: float
    last_event_id: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def new(cls, symbol: str, state: SymbolLifecycleState = "QUIET") -> "SymbolState":
        return cls(
            symbol=symbol,
            state=state,
            last_transition_at=datetime.utcnow().isoformat(),
            state_score=0.0,
            last_event_id=None,
        )
