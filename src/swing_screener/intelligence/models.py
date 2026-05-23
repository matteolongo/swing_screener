from __future__ import annotations

from pydantic import BaseModel

from swing_screener.recommendation.models import DecisionAction, DecisionConviction


class SymbolIntelligenceRequest(BaseModel):
    close: float
    signal: str
    entry: float | None = None
    stop: float | None = None
    sma_20: float | None = None
    sma_50: float | None = None
    sma_200: float | None = None
    momentum_6m: float | None = None
    momentum_12m: float | None = None
    sector: str | None = None
    currency: str = "USD"


class SymbolIntelligence(BaseModel):
    symbol: str
    generated_at: str
    action: DecisionAction
    conviction: DecisionConviction
    summary_line: str
    narrative: str
    sources: list[str]
