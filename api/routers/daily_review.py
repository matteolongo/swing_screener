"""API endpoints for daily review."""

import json

from fastapi import APIRouter, Depends, Query

from api.dependencies import (
    get_portfolio_service,
    get_screener_service,
    get_watchlist_service,
)
from api.models.daily_review import (
    DailyReview,
    DailyReviewSnapshotRequest,
    DailyReviewSnapshotResponse,
)
from api.models.screener import TaxonomyFilter
from api.services.daily_review_service import DailyReviewService
from api.services.portfolio_service import PortfolioService
from api.services.screener_service import ScreenerService
from api.services.watchlist_service import WatchlistService

router = APIRouter(prefix="/daily-review", tags=["daily-review"])


def get_daily_review_service(
    screener_service: ScreenerService = Depends(get_screener_service),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
    watchlist_service: WatchlistService = Depends(get_watchlist_service),
) -> DailyReviewService:
    """Dependency injection for DailyReviewService."""
    return DailyReviewService(
        screener_service, portfolio_service, watchlist_service=watchlist_service
    )


@router.get("", response_model=DailyReview)
def get_daily_review(
    top_n: int = Query(
        default=200, ge=1, le=200, description="Number of top candidates to include"
    ),
    universe: str | None = Query(
        default=None,
        description="Deprecated universe alias. Defaults to screener service default.",
    ),
    preset: str | None = Query(
        default=None,
        description="Taxonomy preset id mirroring the screener selection.",
    ),
    taxonomy_filter: str | None = Query(
        default=None,
        description="JSON-encoded TaxonomyFilter mirroring the screener selection.",
    ),
    include_candidates: bool = Query(
        default=True,
        description=(
            "Run screener discovery candidates. Set false for a portfolio-only review."
        ),
    ),
    service: DailyReviewService = Depends(get_daily_review_service),
) -> DailyReview:
    """
    Get daily review with new trade candidates and position actions.

    Returns:
        - Top N screener candidates
        - Positions requiring no action
        - Positions needing stop updates
        - Positions suggested for closing
        - Summary statistics
    """
    parsed_filter: TaxonomyFilter | None = None
    if taxonomy_filter:
        try:
            payload = json.loads(taxonomy_filter)
            if isinstance(payload, dict) and payload:
                parsed_filter = TaxonomyFilter(**payload)
        except (ValueError, TypeError):
            parsed_filter = None
    return service.generate_daily_review(
        top_n=top_n,
        universe=universe,
        preset=preset,
        taxonomy_filter=parsed_filter,
        include_candidates=include_candidates,
    )


@router.post("/snapshots", response_model=DailyReviewSnapshotResponse, status_code=201)
def save_daily_review_snapshot(
    request: DailyReviewSnapshotRequest,
    service: DailyReviewService = Depends(get_daily_review_service),
) -> DailyReviewSnapshotResponse:
    """Persist an explicitly supplied daily-review snapshot."""
    service.save_snapshot(request.review, request.strategy_name)
    return DailyReviewSnapshotResponse()
