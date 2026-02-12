"""Service for generating daily review with action items."""
import json
import logging
from datetime import date
from pathlib import Path

from api.models.daily_review import (
    DailyReview,
    DailyReviewCandidate,
    DailyReviewPositionHold,
    DailyReviewPositionUpdate,
    DailyReviewPositionClose,
    DailyReviewSummary,
)
from api.models.screener import ScreenerRequest
from api.services.screener_service import ScreenerService
from api.services.portfolio_service import PortfolioService

logger = logging.getLogger(__name__)


class DailyReviewService:
    """Service for generating daily review with trade candidates and position actions."""

    def __init__(
        self,
        screener_service: ScreenerService,
        portfolio_service: PortfolioService,
        data_dir: Path = Path("data"),
    ):
        self.screener = screener_service
        self.portfolio = portfolio_service
        self.data_dir = data_dir
        self.daily_reviews_dir = data_dir / "daily_reviews"
        self.daily_reviews_dir.mkdir(parents=True, exist_ok=True)

    def generate_daily_review(self, top_n: int = 10) -> DailyReview:
        """
        Generate comprehensive daily review.
        
        Args:
            top_n: Number of top screener candidates to include (default: 10)
        
        Returns:
            DailyReview with new candidates and position actions categorized
        """
        # 1. Run screener to get new candidates
        screener_request = ScreenerRequest(top=top_n)
        screener_result = self.screener.run_screener(screener_request)
        candidates = screener_result.candidates[:top_n]
        
        # Convert to daily review format
        new_candidates = [
            DailyReviewCandidate(
                ticker=c.ticker,
                confidence=c.confidence,
                signal=c.signal or "UNKNOWN",
                entry=c.entry or 0.0,
                stop=c.stop or 0.0,
                shares=c.shares or 0,
                r_reward=c.rr or 0.0,
                name=c.name,
                sector=c.sector,
                recommendation=c.recommendation,
            )
            for c in candidates
        ]
        
        # 2. Analyze all open positions
        positions_response = self.portfolio.list_positions(status="open")
        positions = positions_response.positions
        
        positions_hold: list[DailyReviewPositionHold] = []
        positions_update: list[DailyReviewPositionUpdate] = []
        positions_close: list[DailyReviewPositionClose] = []
        
        for pos in positions:
            # Get stop suggestion for this position
            suggestion = self.portfolio.suggest_position_stop(pos.position_id)
            
            # Categorize based on action
            if suggestion.action == "NO_ACTION":
                positions_hold.append(
                    DailyReviewPositionHold(
                        position_id=pos.position_id,
                        ticker=pos.ticker,
                        entry_price=pos.entry_price,
                        stop_price=pos.stop_price,
                        current_price=suggestion.last,
                        r_now=suggestion.r_now,
                        reason=suggestion.reason,
                    )
                )
            
            elif suggestion.action == "MOVE_STOP_UP":
                positions_update.append(
                    DailyReviewPositionUpdate(
                        position_id=pos.position_id,
                        ticker=pos.ticker,
                        entry_price=pos.entry_price,
                        stop_current=pos.stop_price,
                        stop_suggested=suggestion.stop_suggested,
                        current_price=suggestion.last,
                        r_now=suggestion.r_now,
                        reason=suggestion.reason,
                    )
                )
            
            elif suggestion.action in ["CLOSE_STOP_HIT", "CLOSE_TIME_EXIT"]:
                positions_close.append(
                    DailyReviewPositionClose(
                        position_id=pos.position_id,
                        ticker=pos.ticker,
                        entry_price=pos.entry_price,
                        stop_price=pos.stop_price,
                        current_price=suggestion.last,
                        r_now=suggestion.r_now,
                        reason=suggestion.reason,
                    )
                )
        
        # 3. Build summary
        summary = DailyReviewSummary(
            total_positions=len(positions),
            no_action=len(positions_hold),
            update_stop=len(positions_update),
            close_positions=len(positions_close),
            new_candidates=len(new_candidates),
            review_date=date.today(),
        )
        
        review = DailyReview(
            new_candidates=new_candidates,
            positions_hold=positions_hold,
            positions_update_stop=positions_update,
            positions_close=positions_close,
            summary=summary,
        )
        
        # Save to historical file (use "default" as strategy name for now)
        self._save_review(review, "default")
        
        return review
    
    def _save_review(self, review: DailyReview, strategy_name: str) -> None:
        """
        Save daily review to historical file.
        
        Args:
            review: DailyReview to save
            strategy_name: Name of the strategy used
        """
        review_date = review.summary.review_date
        filename = f"daily_review_{review_date.isoformat()}_{strategy_name}.json"
        filepath = self.daily_reviews_dir / filename
        
        # Convert to dict for JSON serialization
        review_dict = review.model_dump(mode="json")
        
        with open(filepath, 'w') as f:
            json.dump(review_dict, f, indent=2)
        
        logger.info(f"Daily review saved to {filepath}")
