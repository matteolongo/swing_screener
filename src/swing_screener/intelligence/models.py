from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

from swing_screener.recommendation.models import DecisionAction, DecisionConviction


class IntelligenceEventType(str, Enum):
    earnings = "earnings"
    macro = "macro"
    dividend = "dividend"
    product_launch = "product_launch"
    regulatory = "regulatory"
    other = "other"


class IntelligenceEventDirection(str, Enum):
    bullish = "bullish"
    bearish = "bearish"
    neutral = "neutral"


class IntelligenceEvent(BaseModel):
    type: IntelligenceEventType
    date: str | None = None
    direction: IntelligenceEventDirection
    summary: str


class PositionSignalAction(str, Enum):
    HOLD = "HOLD"
    TRIM = "TRIM"
    EXIT = "EXIT"


class PositionSignal(BaseModel):
    action: PositionSignalAction
    reason: str


class PositionOutlook(BaseModel):
    expected_holding_period: Literal["days", "1-2_weeks", "2-6_weeks", "unknown"]
    hold_until: str
    next_review_trigger: str
    thesis_status: Literal["intact", "weakening", "broken", "unclear"]
    invalidation_signals: list[str] = Field(default_factory=list)
    profit_management: Literal["hold_full", "consider_trim", "trail_stop", "protect_breakeven", "exit"]
    opportunity_cost: Literal["low", "medium", "high"]
    confidence_decay: str


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
    entry_price: float | None = None
    r_now: float | None = None
    days_open: int | None = None


class SymbolIntelligence(BaseModel):
    symbol: str
    generated_at: str
    action: DecisionAction
    conviction: DecisionConviction
    catalyst_urgency: Literal["high", "medium", "low", "none"] = "none"
    summary_line: str
    narrative: str
    upcoming_events: list[IntelligenceEvent] = []
    position_signal: PositionSignal | None = None
    position_outlook: PositionOutlook | None = None
    sources: list[str] = []
