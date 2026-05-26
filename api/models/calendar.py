# api/models/calendar.py
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel


class CalendarEvent(BaseModel):
    date: str  # YYYY-MM-DD
    ticker: str | None = None
    event_type: Literal["earnings", "economic"]
    title: str
    source_tag: Literal["position", "screener", "economic"]


class CalendarEventsResponse(BaseModel):
    events: list[CalendarEvent]
    days_ahead: int
