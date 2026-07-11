from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Direction = Literal["bullish", "bearish", "neutral"]
BalanceLabel = Literal[
    "strongly_bullish", "bullish", "mixed", "bearish", "strongly_bearish"
]
SignalCategory = Literal["technical", "fundamental", "catalyst", "news", "positioning"]


class WeightedSignal(BaseModel):
    key: str
    label: str
    category: SignalCategory
    direction: Direction
    weight: float
    contribution: float
    source: str
    event_date: str | None = None
    explanation: str | None = None


class EvidenceLedger(BaseModel):
    contributions: list[WeightedSignal] = Field(default_factory=list)
    bull_weight: float = 0.0
    bear_weight: float = 0.0
    net: float = 0.0
    balance_label: BalanceLabel = "mixed"
