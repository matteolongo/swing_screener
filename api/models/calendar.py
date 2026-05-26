# api/models/calendar.py
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel


class CalendarEvent(BaseModel):
    date: str  # YYYY-MM-DD
    ticker: Optional[str] = None
    event_type: Literal["earnings", "economic"]
    title: str
    source_tag: Literal["position", "screener", "economic"]


class CalendarEventsResponse(BaseModel):
    events: list[CalendarEvent]
    days_ahead: int
