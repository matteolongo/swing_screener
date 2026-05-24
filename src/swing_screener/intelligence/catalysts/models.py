from __future__ import annotations
from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field


class CatalystOpportunityState(str, Enum):
    CATALYST_ACTIVE = "CATALYST_ACTIVE"
    TRENDING = "TRENDING"
    WATCH = "WATCH"
    COOLING_OFF = "COOLING_OFF"
    QUIET = "QUIET"


class SourceEvidence(BaseModel):
    title: str
    url: str
    publisher: str | None = None
    published_at: str | None = None
    quote_or_summary: str
    relevance: str


class MarketTheme(BaseModel):
    name: str
    summary: str
    time_horizon: Literal["short_term", "medium_term", "long_term"]
    confidence: float = Field(ge=0, le=1)


class CausalChainStep(BaseModel):
    step: int
    cause: str
    effect: str
    affected_sector: str | None = None


class CompanyCatalyst(BaseModel):
    ticker: str
    company_name: str
    exchange: str | None = None
    benefit_type: Literal["first_order", "second_order", "third_order", "bottleneck", "loser"]
    thesis: str
    causal_chain: list[CausalChainStep]
    evidence: list[SourceEvidence]
    catalyst_strength: float = Field(ge=0, le=10)
    market_awareness: float = Field(ge=0, le=10)
    priced_in_risk: float = Field(ge=0, le=10)
    swing_relevance: float = Field(ge=0, le=10)
    risk_level: Literal["low", "medium", "high"]
    key_risks: list[str]
    expected_time_horizon: Literal["days", "weeks", "months", "multi_year"]


class CatalystReport(BaseModel):
    report_id: str
    event_summary: str
    themes: list[MarketTheme]
    causal_chains: list[CausalChainStep]
    beneficiaries: list[CompanyCatalyst]
    losers: list[CompanyCatalyst]
    hidden_opportunities: list[CompanyCatalyst]
    non_actionable_notes: list[str]
    generated_at: str  # ISO datetime string


class CatalystOpportunity(BaseModel):
    ticker: str
    state: CatalystOpportunityState
    catalyst_strength: float = Field(ge=0, le=10)
    thesis: str
    key_risks: list[str] = []
    sources: list[str] = []  # URLs from evidence
    report_id: str
    generated_at: str  # ISO datetime string
