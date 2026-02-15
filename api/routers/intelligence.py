"""Market intelligence router."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from api.dependencies import get_intelligence_service
from api.models.intelligence import (
    IntelligenceOpportunitiesResponse,
    IntelligenceRunLaunchResponse,
    IntelligenceRunRequest,
    IntelligenceRunStatusResponse,
)
from api.services.intelligence_service import IntelligenceService

router = APIRouter()


@router.post("/run", response_model=IntelligenceRunLaunchResponse)
def run_intelligence(
    request: IntelligenceRunRequest,
    service: IntelligenceService = Depends(get_intelligence_service),
):
    return service.start_run(request)


@router.get("/run/{job_id}", response_model=IntelligenceRunStatusResponse)
def get_run_status(
    job_id: str,
    service: IntelligenceService = Depends(get_intelligence_service),
):
    return service.get_run_status(job_id)


@router.get("/opportunities", response_model=IntelligenceOpportunitiesResponse)
def get_opportunities(
    asof_date: str | None = Query(default=None),
    service: IntelligenceService = Depends(get_intelligence_service),
):
    return service.get_opportunities(asof_date=asof_date)

