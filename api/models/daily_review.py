"""Data models for daily review endpoint."""
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field
from api.models.recommendation import Recommendation
from api.models.portfolio import Position
from api.models.screener import SameSymbolCandidateContext
from api.models.strategy import Strategy
from swing_screener.recommendation.models import DecisionSummary


class DailyReviewCandidate(BaseModel):
    """A new trade candidate from the screener."""
    ticker: str
    currency: str = "USD"
    rank: int | None = None
    priority_rank: int | None = None
    confidence: float | None = None
    signal: str
    close: float
    score: float | None = None
    atr: float | None = None
    sma_20: float | None = None
    sma_50: float | None = None
    sma_200: float | None = None
    momentum_6m: float | None = None
    momentum_12m: float | None = None
    rel_strength: float | None = None
    entry: float
    stop: float
    shares: int
    r_reward: float = Field(..., description="Potential reward in R-multiples")
    name: str | None = None
    sector: str | None = None
    suggested_order_type: Optional[str] = None
    suggested_order_price: Optional[float] = None
    execution_note: Optional[str] = None
    recommendation: Optional[Recommendation] = None
    same_symbol: Optional[SameSymbolCandidateContext] = None
    decision_summary: Optional[DecisionSummary] = None


class DailyReviewPositionHold(BaseModel):
    """A position that requires no action (keep current stop)."""
    position_id: str
    ticker: str
    entry_price: float
    stop_price: float
    current_price: float
    r_now: float
    days_open: int = 0
    time_stop_warning: bool = False
    reason: str = Field(..., description="Why no action is needed")


class DailyReviewPositionUpdate(BaseModel):
    """A position that needs stop price update."""
    position_id: str
    ticker: str
    entry_price: float
    stop_current: float
    stop_suggested: float
    current_price: float
    r_now: float
    days_open: int = 0
    time_stop_warning: bool = False
    reason: str = Field(..., description="Why stop should be updated")


class DailyReviewPositionClose(BaseModel):
    """A position that should be closed."""
    position_id: str
    ticker: str
    entry_price: float
    stop_price: float
    current_price: float
    r_now: float
    days_open: int = 0
    time_stop_warning: bool = False
    reason: str = Field(..., description="Why position should be closed")


class DailyReviewSummary(BaseModel):
    """Summary statistics for the daily review."""
    total_positions: int
    no_action: int
    update_stop: int
    close_positions: int
    new_candidates: int
    add_on_candidates: int = 0
    review_date: date


class DailyReview(BaseModel):
    """Complete daily review with action items."""
    new_candidates: list[DailyReviewCandidate]
    positions_add_on_candidates: list[DailyReviewCandidate] = Field(default_factory=list)
    positions_hold: list[DailyReviewPositionHold]
    positions_update_stop: list[DailyReviewPositionUpdate]
    positions_close: list[DailyReviewPositionClose]
    summary: DailyReviewSummary


class DailyReviewComputeRequest(BaseModel):
    strategy: Strategy
    positions: list[Position] = Field(default_factory=list)
    orders: list = Field(default_factory=list)
    top_n: int = Field(default=200, ge=1, le=200)
    universe: Optional[str] = None
