"""API endpoints for daily review."""
from fastapi import APIRouter, Depends, Query

from api.models.daily_review import DailyReview
from api.services.daily_review_service import DailyReviewService
from api.services.screener_service import ScreenerService
from api.services.portfolio_service import PortfolioService
from api.dependencies import (
    get_screener_service,
    get_portfolio_service,
)

router = APIRouter(prefix="/daily-review", tags=["daily-review"])


def get_daily_review_service(
    screener_service: ScreenerService = Depends(get_screener_service),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> DailyReviewService:
    """Dependency injection for DailyReviewService."""
    return DailyReviewService(screener_service, portfolio_service)


@router.get("", response_model=DailyReview)
def get_daily_review(
    top_n: int = Query(default=10, ge=1, le=50, description="Number of top candidates to include"),
    universe: str | None = Query(
        default=None,
        description="Optional universe name (e.g., amsterdam_all). Defaults to screener service default.",
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
    return service.generate_daily_review(top_n=top_n, universe=universe)
