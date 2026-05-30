"""Response model for open-position intelligence summaries."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from swing_screener.intelligence.models import SymbolIntelligence


class OpenPositionIntelligenceSummary(BaseModel):
    position_id: str
    ticker: str
    entry_price: float
    stop_price: float
    current_price: Optional[float] = None
    r_now: float
    days_open: int
    stop_action: str
    stop_suggested: float
    stop_reason: str
    intelligence: Optional[SymbolIntelligence] = None
