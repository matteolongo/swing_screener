from __future__ import annotations
from pydantic import BaseModel

class TickerRecurrence(BaseModel):
    ticker: str
    days_seen: int
    streak: int
    last_seen: str  # ISO date

class ScreenerRecurrenceResponse(BaseModel):
    items: list[TickerRecurrence]
