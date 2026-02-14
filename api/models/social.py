"""Social analysis models."""
from __future__ import annotations

from typing import Literal, Optional, Any
from pydantic import BaseModel, Field


class SocialRawEvent(BaseModel):
    source: str
    symbol: str
    timestamp: str
    text: str
    author_id_hash: Optional[str] = None
    upvotes: Optional[int] = None
    url: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SocialAnalysisRequest(BaseModel):
    symbol: str
    lookback_hours: Optional[int] = Field(default=None, ge=1)
    providers: Optional[list[str]] = None
    sentiment_analyzer: Optional[str] = None
    max_events: Optional[int] = Field(default=None, ge=1, le=500)


class SocialAnalysisResponse(BaseModel):
    status: Literal["ok", "no_data", "error"]
    symbol: str
    providers: list[str]
    sentiment_analyzer: str
    lookback_hours: int
    last_execution_at: str
    sample_size: int
    sentiment_score: Optional[float] = None
    sentiment_confidence: Optional[float] = None
    attention_score: float
    attention_z: Optional[float] = None
    hype_score: Optional[float] = None
    source_breakdown: dict[str, int] = Field(default_factory=dict)
    reasons: list[str] = Field(default_factory=list)
    raw_events: list[SocialRawEvent] = Field(default_factory=list)
    error: Optional[str] = None
