from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

DecisionAction = Literal[
    "BUY_NOW",
    "BUY_ON_PULLBACK",
    "WAIT_FOR_BREAKOUT",
    "WATCH",
    "TACTICAL_ONLY",
    "AVOID",
    "MANAGE_ONLY",
]
DecisionConviction = Literal["high", "medium", "low"]
SignalLabel = Literal["strong", "neutral", "weak"]
ValuationLabel = Literal["cheap", "fair", "expensive", "unknown"]
CatalystLabel = Literal["active", "neutral", "weak"]
FairValueMethod = Literal["earnings_multiple", "sales_multiple", "book_multiple", "not_available"]


class DecisionTradePlan(BaseModel):
    entry: float | None = None
    stop: float | None = None
    target: float | None = None
    rr: float | None = None


class DecisionValuationContext(BaseModel):
    method: FairValueMethod = "not_available"
    summary: str | None = None
    trailing_pe: float | None = None
    price_to_sales: float | None = None
    fair_value_low: float | None = None
    fair_value_base: float | None = None
    fair_value_high: float | None = None
    premium_discount_pct: float | None = None


class DecisionDrivers(BaseModel):
    positives: list[str] = Field(default_factory=list)
    negatives: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class DecisionSummary(BaseModel):
    symbol: str
    action: DecisionAction
    conviction: DecisionConviction
    technical_label: SignalLabel
    fundamentals_label: SignalLabel
    valuation_label: ValuationLabel
    catalyst_label: CatalystLabel
    why_now: str
    what_to_do: str
    main_risk: str
    trade_plan: DecisionTradePlan = Field(default_factory=DecisionTradePlan)
    valuation_context: DecisionValuationContext = Field(default_factory=DecisionValuationContext)
    drivers: DecisionDrivers = Field(default_factory=DecisionDrivers)
