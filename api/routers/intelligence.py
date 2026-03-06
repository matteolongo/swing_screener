"""Market intelligence router."""
from __future__ import annotations

import hashlib
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_intelligence_config_service, get_intelligence_service
from api.models.intelligence import (
    IntelligenceEventsResponse,
    IntelligenceEducationGenerateRequest,
    IntelligenceEducationGenerateResponse,
    IntelligenceExplainSymbolRequest,
    IntelligenceExplainSymbolResponse,
    IntelligenceMetricsResponse,
    IntelligenceOpportunitiesResponse,
    IntelligenceRunLaunchResponse,
    IntelligenceRunRequest,
    IntelligenceRunStatusResponse,
    IntelligenceSourcesHealthResponse,
    IntelligenceUpcomingCatalystsResponse,
    LLMClassifyNewsRequest,
    LLMClassifyNewsResponse,
    LLMEventClassificationResponse,
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
from swing_screener.intelligence.llm.factory import build_event_classifier

router = APIRouter()


# Singleton classifier cache to reuse instances and avoid file handle leaks.
_classifier_cache: dict[tuple[str, str, str, str], Any] = {}


def _api_key_fingerprint(api_key: str | None) -> str:
    if not api_key:
        return ""
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def get_or_create_classifier(
    provider_name: str,
    model: str,
    base_url: str | None = None,
    api_key: str | None = None,
) -> Any:
    """Get or create a singleton EventClassifier for provider/model/base_url/api-key."""
    normalized_provider = str(provider_name).strip().lower()
    normalized_model = str(model).strip()
    normalized_url = str(base_url or "").strip()
    normalized_key = str(api_key or "").strip()
    cache_key = (
        normalized_provider,
        normalized_model,
        normalized_url,
        _api_key_fingerprint(normalized_key),
    )

    if cache_key not in _classifier_cache:
        try:
            classifier = build_event_classifier(
                provider_name=normalized_provider,
                model=normalized_model,
                base_url=normalized_url or None,
                api_key=normalized_key or None,
                cache_path="data/intelligence/llm_cache.json",
                audit_path="data/intelligence/llm_audit",
                enable_cache=True,
                enable_audit=True,
            )
        except Exception as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

        if not classifier.provider.is_available():
            raise HTTPException(
                status_code=503,
                detail=f"Provider '{normalized_provider}' model '{normalized_model}' is not available.",
            )

        _classifier_cache[cache_key] = classifier

    return _classifier_cache[cache_key]


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


@router.post("/explain-symbol", response_model=IntelligenceExplainSymbolResponse)
def explain_symbol(
    request: IntelligenceExplainSymbolRequest,
    service: IntelligenceService = Depends(get_intelligence_service),
):
    return service.explain_symbol(request)


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


@router.post("/classify", response_model=LLMClassifyNewsResponse)
def classify_news(request: LLMClassifyNewsRequest):
    """Classify financial news headlines using the configured LLM provider."""
    provider_name = str(request.provider or "ollama").strip().lower()
    if provider_name not in LLMClassifyNewsRequest.SUPPORTED_LLM_PROVIDERS:
        allowed = ", ".join(sorted(LLMClassifyNewsRequest.SUPPORTED_LLM_PROVIDERS))
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider: {provider_name}. Allowed providers: {allowed}",
        )

    model_default = "gpt-4o-mini" if provider_name == "openai" else "mistral:7b-instruct"
    model = str(request.model or model_default).strip() or model_default
    base_url = str(request.base_url or "").strip() or None
    api_key = str(request.api_key or "").strip() or None

    try:
        classifier = get_or_create_classifier(provider_name, model, base_url=base_url, api_key=api_key)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize LLM provider: {str(exc)}",
        ) from exc

    results = []
    try:
        for item in request.headlines:
            result = classifier.classify(
                headline=item["headline"],
                snippet=item.get("snippet", ""),
            )

            classification = LLMEventClassificationResponse(
                headline=result.news_item.headline,
                snippet=result.news_item.snippet,
                event_type=result.classification.event_type.value,
                severity=result.classification.severity.value,
                primary_symbol=result.classification.primary_symbol,
                secondary_symbols=result.classification.secondary_symbols,
                is_material=result.classification.is_material,
                confidence=result.classification.confidence,
                summary=result.classification.summary,
                model=result.model_name,
                processing_time_ms=result.processing_time_ms,
                cached=result.cached,
            )
            results.append(classification)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Classification failed: {str(exc)}",
        ) from exc

    total = len(results)
    avg_time = sum(r.processing_time_ms for r in results) / total if total > 0 else 0
    cached_count = sum(1 for r in results if r.cached)
    material_count = sum(1 for r in results if r.is_material)

    return LLMClassifyNewsResponse(
        total=total,
        classifications=results,
        avg_processing_time_ms=avg_time,
        cached_count=cached_count,
        material_count=material_count,
        provider_available=classifier.provider.is_available(),
    )
