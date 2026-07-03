from __future__ import annotations

from datetime import datetime
from typing import Any, TypedDict

from swing_screener.intelligence.history import HistoryEntry
from swing_screener.intelligence.models import (
    SymbolIntelligence,
    SymbolIntelligenceRequest,
)


class AnalyzerState(TypedDict, total=False):
    ticker: str
    req: SymbolIntelligenceRequest
    past_positions: list[dict]
    now: datetime
    pre_open: bool
    pre_open_since: str | None
    prior_digest: list[HistoryEntry]
    has_position: bool
    inputs_used: dict
    user_prompt: str
    search_text: str
    draft: Any
    tokens: int | None
    result: SymbolIntelligence
    _search_usage: Any
    _parse_usage: Any
