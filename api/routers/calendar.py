"""Calendar router for events endpoints."""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Query

from api.dependencies import DATA_DIR, get_positions_repo
from api.db.repositories import SqlPositionsRepository
from api.models.calendar import CalendarEventsResponse
from api.services.calendar_service import CalendarService

router = APIRouter()


def get_calendar_service(
    positions_repo: SqlPositionsRepository = Depends(get_positions_repo),
) -> CalendarService:
    """Dependency: inject CalendarService with injected PositionsRepository."""
    return CalendarService(
        positions_repo=positions_repo,
        data_dir=DATA_DIR,
        finnhub_api_key=os.environ.get("FINNHUB_API_KEY"),
    )


@router.get("/calendar/events", response_model=CalendarEventsResponse)
def get_calendar_events(
    days_ahead: int = Query(default=60, ge=1, le=90),
    candidate_tickers: str | None = Query(
        default=None, max_length=4096,
        pattern=r"^(?:[A-Za-z0-9][A-Za-z0-9.-]{0,15}(?:,[A-Za-z0-9][A-Za-z0-9.-]{0,15})*)?$",
    ),
    service: CalendarService = Depends(get_calendar_service),
) -> CalendarEventsResponse:
    """
    Get upcoming calendar events (earnings, economic events) for positions and screener candidates.

    Args:
        days_ahead: Number of days to look ahead (1-90, default 60)
        candidate_tickers: Comma-separated current review symbols; omitted uses legacy snapshots.
        service: Injected CalendarService

    Returns:
        CalendarEventsResponse with sorted events and days_ahead
    """
    tickers = None if candidate_tickers is None else {
        ticker.upper() for ticker in candidate_tickers.split(",") if ticker
    }
    return service.get_events(days_ahead=days_ahead, candidate_tickers=tickers)
