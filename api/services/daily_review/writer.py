"""Persistence for daily review snapshots."""
import json
import logging
from pathlib import Path

from api.models.daily_review import DailyReview

logger = logging.getLogger(__name__)


class DailyReviewWriter:
    """Writes daily review snapshots to the historical review directory."""

    def __init__(self, daily_reviews_dir: Path) -> None:
        self.daily_reviews_dir = daily_reviews_dir

    def save(self, review: DailyReview, strategy_name: str) -> None:
        """Save daily review to a dated JSON file."""
        review_date = review.summary.review_date
        filename = f"daily_review_{review_date.isoformat()}_{strategy_name}.json"
        filepath = self.daily_reviews_dir / filename

        review_dict = review.model_dump(mode="json")

        with open(filepath, "w") as f:
            json.dump(review_dict, f, indent=2)

        logger.info(f"Daily review saved to {filepath}")
