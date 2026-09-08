"""Data models for daily review endpoint."""

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

from api.models.portfolio import Position
from api.models.recommendation import Recommendation
from api.models.screener import SameSymbolCandidateContext, TaxonomyFilter
from api.models.strategy import Strategy
from api.models.watchlist import WatchlistItemView
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
    entry: float | None
    stop: float | None
    shares: int | None
    r_reward: float | None = Field(..., description="Potential reward in R-multiples")
    name: str | None = None
    sector: str | None = None
    suggested_order_type: Optional[str] = None
    suggested_order_price: Optional[float] = None
    execution_note: Optional[str] = None
    recommendation: Optional[Recommendation] = None
    same_symbol: Optional[SameSymbolCandidateContext] = None
    decision_summary: Optional[DecisionSummary] = None


class TrimSuggestion(BaseModel):
    """Rules-based trim opportunity detected for a held position."""

    r_threshold: float
    r_now: float


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
    exhaustion_score: Optional[float] = None
    exhaustion_label: Optional[str] = None
    trim_suggestion: TrimSuggestion | None = None


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
    exhaustion_score: Optional[float] = None
    exhaustion_label: Optional[str] = None


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


class DailyReviewPositionExitSignal(BaseModel):
    """A position with a technical deterioration signal (advisory, not a forced close)."""

    position_id: str
    ticker: str
    entry_price: float
    stop_price: float
    current_price: float
    r_now: float
    days_open: int = 0
    reason: str = Field(..., description="Human-readable reason for the signal")


class DailyReviewPositionEvaluationError(BaseModel):
    """Sanitized failure produced while evaluating one position."""

    symbol: str
    code: Literal["position_evaluation_failed"] = "position_evaluation_failed"
    message: str = "Position evaluation could not be completed."


class DailyReviewSummary(BaseModel):
    """Summary statistics for the daily review."""

    total_positions: int
    no_action: int
    update_stop: int
    close_positions: int
    exit_signal: int = 0
    new_candidates: int
    add_on_candidates: int = 0
    watchlist_near_trigger: int = 0
    evaluation_error_count: int = 0
    review_date: date


class PendingOrderReview(BaseModel):
    """Review item for a single pending entry order."""

    order_id: str
    ticker: str
    category: Literal["stale", "still_valid", "no_data"]
    days_pending: int
    note: Optional[str] = None


class DailyReview(BaseModel):
    """Complete daily review with action items."""

    watchlist_near_trigger: list[WatchlistItemView] = Field(default_factory=list)
    new_candidates: list[DailyReviewCandidate]
    positions_add_on_candidates: list[DailyReviewCandidate] = Field(
        default_factory=list
    )
    positions_hold: list[DailyReviewPositionHold]
    positions_update_stop: list[DailyReviewPositionUpdate]
    positions_close: list[DailyReviewPositionClose]
    positions_exit_signal: list[DailyReviewPositionExitSignal] = Field(
        default_factory=list
    )
    evaluation_errors: list[DailyReviewPositionEvaluationError] = Field(
        default_factory=list
    )
    summary: DailyReviewSummary
    pending_orders_review: list[PendingOrderReview] = Field(default_factory=list)


class DailyReviewSnapshotRequest(BaseModel):
    """Explicit command to persist an already-computed daily review."""

    review: DailyReview
    strategy_name: str = Field(
        default="default", min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$"
    )


class DailyReviewSnapshotResponse(BaseModel):
    """Acknowledgement for a persisted daily-review snapshot."""

    saved: bool = True


class DailyReviewComputeRequest(BaseModel):
    strategy: Strategy
    positions: list[Position] = Field(default_factory=list)
    orders: list = Field(default_factory=list)
    top_n: int = Field(default=200, ge=1, le=200)
    universe: Optional[str] = None
    preset: Optional[str] = None
    taxonomy_filter: Optional[TaxonomyFilter] = None
    include_candidates: bool = Field(
        default=True,
        description=(
            "Whether to run the screener and include discovery candidates. "
            "Portfolio-only reviews set this to false."
        ),
    )
