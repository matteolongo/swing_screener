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
    service: CalendarService = Depends(get_calendar_service),
) -> CalendarEventsResponse:
    """
    Get upcoming calendar events (earnings, economic events) for positions and screener candidates.

    Args:
        days_ahead: Number of days to look ahead (1-90, default 30)
        service: Injected CalendarService

    Returns:
        CalendarEventsResponse with sorted events and days_ahead
    """
    events = service.get_events(days_ahead=days_ahead)
    return CalendarEventsResponse(events=events, days_ahead=days_ahead)
