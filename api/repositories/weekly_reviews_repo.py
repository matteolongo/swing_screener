"""Weekly reviews repository — structured end-of-week reflections."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from api.models.weekly_review import WeeklyReview, WeeklyReviewUpsertRequest
from api.utils.file_lock import locked_read_json, locked_write_json


@dataclass
class WeeklyReviewsRepository:
    path: Path

    def _read_reviews(self) -> dict[str, dict]:
        if not self.path.exists():
            return {}
        payload = locked_read_json(self.path)
        if not isinstance(payload, dict):
            return {}
        raw = payload.get("reviews", {})
        if not isinstance(raw, dict):
            return {}
        return raw

    def _write_reviews(self, reviews: dict[str, dict]) -> None:
        locked_write_json(self.path, {"reviews": reviews})

    def list_reviews(self) -> list[WeeklyReview]:
        reviews = self._read_reviews()
        result = []
        for raw in reviews.values():
            try:
                result.append(WeeklyReview.model_validate(raw))
            except Exception:
                continue
        # Newest first
        return sorted(result, key=lambda r: r.week_id, reverse=True)

    def get_review(self, week_id: str) -> WeeklyReview | None:
        reviews = self._read_reviews()
        raw = reviews.get(week_id)
        if raw is None:
            return None
        try:
            return WeeklyReview.model_validate(raw)
        except Exception:
            return None

    def upsert_review(self, week_id: str, request: WeeklyReviewUpsertRequest) -> WeeklyReview:
        reviews = self._read_reviews()
        updated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        review = WeeklyReview(
            week_id=week_id,
            what_worked=request.what_worked,
            what_didnt=request.what_didnt,
            rules_violated=request.rules_violated,
            next_week_focus=request.next_week_focus,
            updated_at=updated_at,
        )
        reviews[week_id] = review.model_dump(mode="json")
        self._write_reviews(reviews)
        return review
