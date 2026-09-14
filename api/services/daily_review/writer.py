"""Persistence for daily review snapshots."""

import json
import logging
import os
import uuid
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

        self.daily_reviews_dir.mkdir(parents=True, exist_ok=True)
        temporary = filepath.with_name(f".{filepath.name}.tmp-{uuid.uuid4().hex}")
        try:
            with temporary.open("w", encoding="utf-8") as handle:
                json.dump(review_dict, handle, indent=2)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, filepath)
        finally:
            temporary.unlink(missing_ok=True)

        logger.info(f"Daily review saved to {filepath}")
