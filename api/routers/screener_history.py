"""Screener history router."""
from __future__ import annotations
from fastapi import APIRouter, Depends
from api.dependencies import get_screener_history_repo
from api.models.screener_history import ScreenerRecurrenceResponse, TickerRecurrence
from api.repositories.screener_history_repo import ScreenerHistoryRepository

router = APIRouter()

@router.get("/recurrence", response_model=ScreenerRecurrenceResponse)
async def get_recurrence(repo: ScreenerHistoryRepository = Depends(get_screener_history_repo)):
    items = [TickerRecurrence(**r) for r in repo.get_recurrence()]
    return ScreenerRecurrenceResponse(items=items)
