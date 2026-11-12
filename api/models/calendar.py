# api/models/calendar.py
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field


class CalendarEvent(BaseModel):
    date: str  # YYYY-MM-DD
    ticker: Optional[str] = None
    event_type: Literal["earnings", "economic", "ipo", "dividend"]
    title: str
    source_tag: Literal["position", "screener", "economic", "ipo"]
    provider: Optional[str] = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    source_url: Optional[str] = None
    eps_estimate: Optional[float] = None
    eps_actual: Optional[float] = None


class CalendarSourceWarning(BaseModel):
    event_type: Literal["earnings", "economic", "ipo", "dividend"]
    code: Literal["source_unavailable"] = "source_unavailable"
    tickers: list[str] = Field(default_factory=list)


class CalendarEventsResponse(BaseModel):
    events: list[CalendarEvent]
    days_ahead: int
    warnings: list[CalendarSourceWarning] = Field(default_factory=list)
