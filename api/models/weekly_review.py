from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class WeeklyReview(BaseModel):
    week_id: str        # "2026-W14" format (ISO week)
    what_worked: str = ""
    what_didnt: str = ""
    rules_violated: str = ""
    next_week_focus: str = ""
    updated_at: str = ""


class WeeklyReviewUpsertRequest(BaseModel):
    what_worked: str = ""
    what_didnt: str = ""
    rules_violated: str = ""
    next_week_focus: str = ""
