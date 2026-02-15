"""Data models for daily review endpoint."""
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field
from api.models.recommendation import Recommendation


class DailyReviewCandidate(BaseModel):
    """A new trade candidate from the screener."""
    ticker: str
    confidence: float | None = None
    signal: str
    entry: float
    stop: float
    shares: int
    r_reward: float = Field(..., description="Potential reward in R-multiples")
    name: str | None = None
    sector: str | None = None
    recommendation: Optional[Recommendation] = None


class DailyReviewPositionHold(BaseModel):
    """A position that requires no action (keep current stop)."""
    position_id: str
    ticker: str
    entry_price: float
    stop_price: float
    current_price: float
    r_now: float
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
    reason: str = Field(..., description="Why stop should be updated")


class DailyReviewPositionClose(BaseModel):
    """A position that should be closed."""
    position_id: str
    ticker: str
    entry_price: float
    stop_price: float
    current_price: float
    r_now: float
    reason: str = Field(..., description="Why position should be closed")


class DailyReviewSummary(BaseModel):
    """Summary statistics for the daily review."""
    total_positions: int
    no_action: int
    update_stop: int
    close_positions: int
    new_candidates: int
    review_date: date


class DailyReview(BaseModel):
    """Complete daily review with action items."""
    new_candidates: list[DailyReviewCandidate]
    positions_hold: list[DailyReviewPositionHold]
    positions_update_stop: list[DailyReviewPositionUpdate]
    positions_close: list[DailyReviewPositionClose]
    summary: DailyReviewSummary
