from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator

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
    trim_pct: float | None = None
    trim_price: float | None = None
    re_entry_zone: dict | None = None


class PriceMoveDriver(BaseModel):
    label: str
    detail: str


class PositionMoveExplanation(BaseModel):
    direction: Literal["up", "down", "flat"]
    summary: str
    drivers: list[PriceMoveDriver] = Field(default_factory=list)


class KeyNumber(BaseModel):
    label: str
    value: str
    sentiment: Literal["bullish", "bearish", "neutral"]

    @field_validator("value", mode="before")
    @classmethod
    def coerce_value_to_string(cls, value: object) -> str:
        return "" if value is None else str(value)


class PredictionBullet(BaseModel):
    direction: Literal["bullish", "bearish", "neutral"]
    reason: str
    reference: str


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
    entry_date: str | None = None
    r_now: float | None = None
    days_open: int | None = None
    # Extended context — decision summary + chart quality + fundamentals
    rr: float | None = None
    target: float | None = None
    rel_strength: float | None = None
    atr: float | None = None
    consolidation_tightness: float | None = None
    breakout_volume_confirmation: bool | None = None
    above_breakout_extension: float | None = None
    fair_value_low: float | None = None
    fair_value_base: float | None = None
    fair_value_high: float | None = None
    valuation_label: Literal["cheap", "fair", "expensive", "unknown"] | None = None
    decision_action: str | None = None
    decision_conviction: str | None = None
    technical_label: str | None = None
    fundamentals_label: str | None = None
    catalyst_summary: str | None = None
    # Finnhub enrichment signals
    insider_net_shares_90d: int | None = None
    insider_transaction_count_90d: int | None = None
    forward_eps_estimate: float | None = None
    analyst_upgrade_downgrade_net_30d: int | None = None
    # 52-week high proximity
    dist_52w_high_pct: float | None = None
    near_52w_high: bool | None = None
    # Sector ETF rotation context
    sector_rs: float | None = None
    sector_rotation_context: dict | None = None
    # Earnings proximity
    days_to_earnings: int | None = None
    next_earnings_date: str | None = None
    # Recent candlestick patterns as "name@context" strings, for the prompt
    recent_patterns: list[str] | None = None
    # Raw fundamentals (filled by the server-side enricher when absent)
    trailing_pe: float | None = None
    revenue_growth_yoy: float | None = None
    gross_margin: float | None = None
    net_margin: float | None = None
    return_on_equity: float | None = None
    debt_to_equity: float | None = None


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
    position_move_explanation: PositionMoveExplanation | None = None
    sources: list[str] = []
    inputs_used: dict = Field(default_factory=dict)
    price_hook: str | None = None
    key_numbers: list[KeyNumber] = Field(default_factory=list)
    risk_factors: list[str] = Field(default_factory=list)
    prediction_bullets: list[PredictionBullet] = Field(default_factory=list)
    past_trades_context: str | None = None
