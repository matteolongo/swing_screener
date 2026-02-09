from __future__ import annotations

from datetime import datetime, date
from typing import Any, Optional

from pydantic import BaseModel, Field


class SocialRawEvent(BaseModel):
    source: str
    symbol: str
    timestamp: datetime
    text: str
    author_id_hash: Optional[str] = None
    upvotes: Optional[int] = None
    url: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SocialDailyMetrics(BaseModel):
    symbol: str
    date: date
    attention_score: float
    attention_z: Optional[float] = None
    sentiment_score: float
    sentiment_confidence: float
    hype_score: Optional[float] = None
    sample_size: int
    source_breakdown: dict[str, int] = Field(default_factory=dict)


class SocialOverlayDecision(BaseModel):
    symbol: str
    date: date
    risk_multiplier: float = 1.0
    max_pos_multiplier: float = 1.0
    veto: bool = False
    review_required: bool = False
    reasons: list[str] = Field(default_factory=list)
