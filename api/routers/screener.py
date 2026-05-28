"""Screener router - Run screener."""
from __future__ import annotations

import os
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from api.models.screener import (
    ScreenerRequest,
    ScreenerResponse,
    ScreenerRunLaunchResponse,
    ScreenerRunStatusResponse,
)
from api.dependencies import get_screener_service, get_screener_history_repo
from api.services.screener_service import ScreenerService
from api.repositories.screener_history_repo import ScreenerHistoryRepository

router = APIRouter()


def _resolve_screener_run_mode() -> str:
    """
    Resolve screener execution mode.

    Defaults to async on dyno platforms to avoid Heroku H12 request timeouts.
    """
    configured = str(os.getenv("SCREENER_RUN_MODE", "")).strip().lower()
    if configured in {"sync", "async"}:
        return configured
    return "async" if os.getenv("DYNO") else "sync"


@router.post(
    "/run",
    response_model=ScreenerResponse,
    responses={202: {"model": ScreenerRunLaunchResponse}},
)
async def run_screener(
    request: ScreenerRequest,
    service: ScreenerService = Depends(get_screener_service),
    history_repo: ScreenerHistoryRepository = Depends(get_screener_history_repo),
):
    """Run screener sync or launch async job depending on environment mode."""
    if _resolve_screener_run_mode() == "async":
        launch = service.start_run_async(request)
        return JSONResponse(status_code=202, content=launch.model_dump())
    result = service.run_screener(request)
    try:
        tickers = [c.ticker for c in result.candidates]
        if tickers:
            history_repo.record_run(result.asof_date, tickers)
    except Exception:
        pass  # Never fail a screener run due to history recording
    return result


@router.get("/run/{job_id}", response_model=ScreenerRunStatusResponse)
def get_run_status(
    job_id: str,
    service: ScreenerService = Depends(get_screener_service),
):
    """Get background screener run status."""
    return service.get_run_status(job_id)
