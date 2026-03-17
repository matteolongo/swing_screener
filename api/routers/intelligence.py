"""Market intelligence router."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_intelligence_config_service, get_intelligence_service
from api.models.intelligence import (
    IntelligenceEventsResponse,
    IntelligenceEducationGenerateRequest,
    IntelligenceEducationGenerateResponse,
    IntelligenceMetricsResponse,
    IntelligenceOpportunitiesResponse,
    IntelligenceRunLaunchResponse,
    IntelligenceRunRequest,
    IntelligenceRunStatusResponse,
    IntelligenceSourcesHealthResponse,
    IntelligenceUpcomingCatalystsResponse,
)
from api.models.intelligence_config import (
    IntelligenceConfigModel,
    IntelligenceProviderInfoResponse,
    IntelligenceProviderTestRequest,
    IntelligenceProviderTestResponse,
    IntelligenceSymbolSetCreateRequest,
    IntelligenceSymbolSetDeleteResponse,
    IntelligenceSymbolSetResponse,
    IntelligenceSymbolSetsResponse,
    IntelligenceSymbolSetUpdateRequest,
)
from api.services.intelligence_config_service import IntelligenceConfigService
from api.services.intelligence_service import IntelligenceService

router = APIRouter()


@router.get("/config", response_model=IntelligenceConfigModel)
def get_config(
    config_service: IntelligenceConfigService = Depends(get_intelligence_config_service),
):
    return config_service.get_config()


@router.put("/config", response_model=IntelligenceConfigModel)
def update_config(
    request: IntelligenceConfigModel,
    config_service: IntelligenceConfigService = Depends(get_intelligence_config_service),
):
    return config_service.update_config(request)


@router.get("/providers", response_model=list[IntelligenceProviderInfoResponse])
def get_providers(
    config_service: IntelligenceConfigService = Depends(get_intelligence_config_service),
):
    return config_service.list_providers()


@router.post("/providers/test", response_model=IntelligenceProviderTestResponse)
def test_provider(
    request: IntelligenceProviderTestRequest,
    config_service: IntelligenceConfigService = Depends(get_intelligence_config_service),
):
    return config_service.test_provider(request)


@router.get("/symbol-sets", response_model=IntelligenceSymbolSetsResponse)
def list_symbol_sets(
    config_service: IntelligenceConfigService = Depends(get_intelligence_config_service),
):
    return IntelligenceSymbolSetsResponse(items=config_service.list_symbol_sets())


@router.post("/symbol-sets", response_model=IntelligenceSymbolSetResponse)
def create_symbol_set(
    request: IntelligenceSymbolSetCreateRequest,
    config_service: IntelligenceConfigService = Depends(get_intelligence_config_service),
):
    return config_service.create_symbol_set(request)


@router.put("/symbol-sets/{symbol_set_id}", response_model=IntelligenceSymbolSetResponse)
def update_symbol_set(
    symbol_set_id: str,
    request: IntelligenceSymbolSetUpdateRequest,
    config_service: IntelligenceConfigService = Depends(get_intelligence_config_service),
):
    return config_service.update_symbol_set(symbol_set_id, request)


@router.delete("/symbol-sets/{symbol_set_id}", response_model=IntelligenceSymbolSetDeleteResponse)
def delete_symbol_set(
    symbol_set_id: str,
    config_service: IntelligenceConfigService = Depends(get_intelligence_config_service),
):
    deleted = config_service.delete_symbol_set(symbol_set_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Symbol set not found: {symbol_set_id}")
    return IntelligenceSymbolSetDeleteResponse(deleted=True, id=symbol_set_id)


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
    symbols: list[str] | None = Query(default=None),
    service: IntelligenceService = Depends(get_intelligence_service),
):
    return service.get_opportunities(asof_date=asof_date, symbols=symbols)


@router.get("/events", response_model=IntelligenceEventsResponse)
def get_events(
    asof_date: str | None = Query(default=None),
    symbols: list[str] | None = Query(default=None),
    event_types: list[str] | None = Query(default=None),
    min_materiality: float | None = Query(default=None),
    service: IntelligenceService = Depends(get_intelligence_service),
):
    return service.get_events(
        asof_date=asof_date,
        symbols=symbols,
        event_types=event_types,
        min_materiality=min_materiality,
    )


@router.get("/upcoming-catalysts", response_model=IntelligenceUpcomingCatalystsResponse)
def get_upcoming_catalysts(
    asof_date: str | None = Query(default=None),
    symbols: list[str] | None = Query(default=None),
    days_ahead: int = Query(default=14, ge=1, le=60),
    service: IntelligenceService = Depends(get_intelligence_service),
):
    return service.get_upcoming_catalysts(
        asof_date=asof_date,
        symbols=symbols,
        days_ahead=days_ahead,
    )


@router.get("/sources/health", response_model=IntelligenceSourcesHealthResponse)
def get_sources_health(
    service: IntelligenceService = Depends(get_intelligence_service),
):
    return service.get_sources_health()


@router.get("/metrics", response_model=IntelligenceMetricsResponse)
def get_metrics(
    asof_date: str | None = Query(default=None),
    service: IntelligenceService = Depends(get_intelligence_service),
):
    return service.get_metrics(asof_date=asof_date)


@router.post("/education/generate", response_model=IntelligenceEducationGenerateResponse)
def generate_symbol_education(
    request: IntelligenceEducationGenerateRequest,
    service: IntelligenceService = Depends(get_intelligence_service),
):
    return service.generate_symbol_education(request)


@router.get("/education/{symbol}", response_model=IntelligenceEducationGenerateResponse)
def get_symbol_education(
    symbol: str,
    asof_date: str | None = Query(default=None),
    service: IntelligenceService = Depends(get_intelligence_service),
):
    return service.get_cached_symbol_education(symbol=symbol, asof_date=asof_date)
