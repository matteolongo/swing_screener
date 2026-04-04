"""Weekly reviews router — end-of-week structured reflections."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_weekly_reviews_repo
from api.models.weekly_review import WeeklyReview, WeeklyReviewUpsertRequest
from api.repositories.weekly_reviews_repo import WeeklyReviewsRepository

router = APIRouter()


@router.get("", response_model=list[WeeklyReview])
async def list_reviews(repo: WeeklyReviewsRepository = Depends(get_weekly_reviews_repo)):
    return repo.list_reviews()


@router.get("/{week_id}", response_model=WeeklyReview)
async def get_review(week_id: str, repo: WeeklyReviewsRepository = Depends(get_weekly_reviews_repo)):
    review = repo.get_review(week_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


@router.put("/{week_id}", response_model=WeeklyReview)
async def upsert_review(
    week_id: str,
    request: WeeklyReviewUpsertRequest,
    repo: WeeklyReviewsRepository = Depends(get_weekly_reviews_repo),
):
    return repo.upsert_review(week_id, request)
