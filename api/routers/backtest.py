"""Backtest router - event-study replay over history."""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from api.dependencies import get_backtest_service
from api.models.backtest import (
    BacktestRunLaunchResponse,
    BacktestRunStatusResponse,
    EventStudyRequest,
    EventStudyResponse,
)
from api.services.backtest_service import BacktestService

logger = logging.getLogger(__name__)

router = APIRouter()


def _resolve_backtest_run_mode() -> str:
    """Async on dyno platforms (avoid request timeouts), sync otherwise."""
    configured = str(os.getenv("BACKTEST_RUN_MODE", "")).strip().lower()
    if configured in {"sync", "async"}:
        return configured
    return "async" if os.getenv("DYNO") else "sync"


@router.post(
    "/event-study",
    response_model=EventStudyResponse,
    responses={202: {"model": BacktestRunLaunchResponse}},
)
def run_event_study(
    request: EventStudyRequest,
    service: BacktestService = Depends(get_backtest_service),
):
    """Run the event study sync or launch it as a background job depending on mode."""
    if _resolve_backtest_run_mode() == "async":
        launch = service.start_run_async(request)
        return JSONResponse(status_code=202, content=launch.model_dump())
    return service.run_event_study(request)


@router.get("/event-study/{job_id}", response_model=BacktestRunStatusResponse)
def get_event_study_status(
    job_id: str,
    service: BacktestService = Depends(get_backtest_service),
):
    """Get background event-study run status."""
    return service.get_run_status(job_id)
