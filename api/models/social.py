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
    provider: Optional[str] = None
    max_events: Optional[int] = Field(default=None, ge=1, le=500)


class SocialAnalysisResponse(BaseModel):
    status: Literal["ok", "no_data", "error"]
    symbol: str
    provider: str
    lookback_hours: int
    last_execution_at: str
    sample_size: int
    sentiment_score: Optional[float] = None
    sentiment_confidence: Optional[float] = None
    attention_score: float
    attention_z: Optional[float] = None
    hype_score: Optional[float] = None
    reasons: list[str] = Field(default_factory=list)
    raw_events: list[SocialRawEvent] = Field(default_factory=list)
    error: Optional[str] = None
