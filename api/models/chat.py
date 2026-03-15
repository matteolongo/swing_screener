"""Workspace chat models."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from api.models.intelligence import (
    IntelligenceEducationGenerateResponse,
    IntelligenceEventResponse,
    IntelligenceOpportunityResponse,
)
from api.models.portfolio import Order, PortfolioSummary, PositionWithMetrics
from api.models.screener import SameSymbolCandidateContext


ChatRole = Literal["user", "assistant"]
WorkspaceFreshnessSource = Literal["portfolio", "screener", "intelligence", "education"]


def _clean_text(value: object, *, upper: bool = False) -> str:
    text = " ".join(str(value or "").split()).strip()
    return text.upper() if upper else text


class ChatTurn(BaseModel):
    role: ChatRole
    content: str = Field(min_length=1, max_length=4000)
    created_at: Optional[str] = None

    @field_validator("content")
    @classmethod
    def _normalize_content(cls, value: str) -> str:
        cleaned = _clean_text(value)
        if not cleaned:
            raise ValueError("content is required")
        return cleaned


class WorkspaceScreenerCandidateSnapshot(BaseModel):
    ticker: str = Field(min_length=1, max_length=16)
    currency: Optional[Literal["USD", "EUR"]] = None
    name: Optional[str] = Field(default=None, max_length=160)
    sector: Optional[str] = Field(default=None, max_length=120)
    rank: Optional[int] = Field(default=None, ge=1)
    score: Optional[float] = None
    confidence: Optional[float] = None
    signal: Optional[str] = Field(default=None, max_length=64)
    close: Optional[float] = None
    entry: Optional[float] = None
    stop: Optional[float] = None
    target: Optional[float] = None
    rr: Optional[float] = None
    shares: Optional[int] = Field(default=None, ge=0)
    position_size_usd: Optional[float] = None
    risk_usd: Optional[float] = None
    risk_pct: Optional[float] = None
    recommendation_verdict: Optional[str] = Field(default=None, max_length=64)
    reasons_short: list[str] = Field(default_factory=list, max_length=8)
    beginner_explanation: Optional[str] = Field(default=None, max_length=1600)
    same_symbol: Optional[SameSymbolCandidateContext] = None

    @field_validator("ticker")
    @classmethod
    def _normalize_ticker(cls, value: str) -> str:
        cleaned = _clean_text(value, upper=True)
        if not cleaned:
            raise ValueError("ticker is required")
        return cleaned

    @field_validator("reasons_short")
    @classmethod
    def _normalize_reasons(cls, values: list[str]) -> list[str]:
        seen: set[str] = set()
        normalized: list[str] = []
        for value in values:
            cleaned = _clean_text(value)
            if not cleaned or cleaned in seen:
                continue
            seen.add(cleaned)
            normalized.append(cleaned)
        return normalized


class WorkspaceSnapshot(BaseModel):
    asof_date: Optional[str] = None
    data_freshness: Optional[Literal["final_close", "intraday"]] = None
    total_screened: Optional[int] = Field(default=None, ge=0)
    candidates: list[WorkspaceScreenerCandidateSnapshot] = Field(default_factory=list, max_length=200)

    @field_validator("candidates")
    @classmethod
    def _dedupe_candidates(
        cls,
        values: list[WorkspaceScreenerCandidateSnapshot],
    ) -> list[WorkspaceScreenerCandidateSnapshot]:
        seen: set[str] = set()
        normalized: list[WorkspaceScreenerCandidateSnapshot] = []
        for value in values:
            if value.ticker in seen:
                continue
            seen.add(value.ticker)
            normalized.append(value)
        return normalized


class WorkspaceContextSourceMeta(BaseModel):
    source: WorkspaceFreshnessSource
    label: str
    loaded: bool
    origin: str
    asof: Optional[str] = None
    count: int = Field(default=0, ge=0)


class WorkspaceContextMeta(BaseModel):
    selected_ticker: Optional[str] = None
    sources: list[WorkspaceContextSourceMeta] = Field(default_factory=list)

    @field_validator("selected_ticker")
    @classmethod
    def _normalize_selected_ticker(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _clean_text(value, upper=True)
        return cleaned or None


class WorkspaceIntelligenceContext(BaseModel):
    asof_date: Optional[str] = None
    opportunities: list[IntelligenceOpportunityResponse] = Field(default_factory=list)
    events: list[IntelligenceEventResponse] = Field(default_factory=list)
    education: Optional[IntelligenceEducationGenerateResponse] = None


class WorkspaceContext(BaseModel):
    selected_ticker: Optional[str] = None
    orders: list[Order] = Field(default_factory=list)
    positions: list[PositionWithMetrics] = Field(default_factory=list)
    portfolio_summary: Optional[PortfolioSummary] = None
    screener_snapshot: Optional[WorkspaceSnapshot] = None
    selected_candidate: Optional[WorkspaceScreenerCandidateSnapshot] = None
    intelligence: Optional[WorkspaceIntelligenceContext] = None
    warnings: list[str] = Field(default_factory=list)
    fact_map: dict[str, str] = Field(default_factory=dict)
    meta: WorkspaceContextMeta


class ChatAnswerRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    conversation: list[ChatTurn] = Field(default_factory=list, max_length=20)
    selected_ticker: Optional[str] = None
    workspace_snapshot: Optional[WorkspaceSnapshot] = None

    @field_validator("question")
    @classmethod
    def _normalize_question(cls, value: str) -> str:
        cleaned = _clean_text(value)
        if not cleaned:
            raise ValueError("question is required")
        return cleaned

    @field_validator("selected_ticker")
    @classmethod
    def _normalize_request_ticker(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _clean_text(value, upper=True)
        return cleaned or None


class ChatAnswerResponse(BaseModel):
    answer: str = Field(min_length=1, max_length=4000)
    warnings: list[str] = Field(default_factory=list, max_length=12)
    facts_used: list[str] = Field(default_factory=list, max_length=16)
    context_meta: WorkspaceContextMeta
    conversation_state: list[ChatTurn] = Field(default_factory=list)

    @field_validator("answer")
    @classmethod
    def _normalize_answer(cls, value: str) -> str:
        cleaned = _clean_text(value)
        if not cleaned:
            raise ValueError("answer is required")
        return cleaned
