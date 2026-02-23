"""Market intelligence router."""
from __future__ import annotations

import threading
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_intelligence_service
from api.models.intelligence import (
    IntelligenceEventsResponse,
    IntelligenceOpportunitiesResponse,
    IntelligenceRunLaunchResponse,
    IntelligenceRunRequest,
    IntelligenceRunStatusResponse,
    LLMClassifyNewsRequest,
    LLMClassifyNewsResponse,
    LLMEventClassificationResponse,
)
from api.services.intelligence_service import IntelligenceService

router = APIRouter()


# Singleton classifier cache to reuse instances and avoid file handle leaks.
# Key: (provider, model, cache_path, audit_path), Value: EventClassifier instance.
_classifier_cache: dict[tuple[str, str, str, str], Any] = {}
_classifier_cache_lock = threading.Lock()


def get_or_create_classifier(
    provider_name: str,
    model: str | None,
    *,
    api_key: str | None = None,
    base_url: str | None = None,
    cache_path: str = "data/intelligence/llm_cache.json",
    audit_path: str = "data/intelligence/llm_audit",
) -> Any:
    """Get or create a singleton EventClassifier for provider/model/path tuple."""
    from swing_screener.intelligence.llm import EventClassifier

    model_key = str(model).strip() or "__default__"
    key = (provider_name, model_key, cache_path, audit_path)

    with _classifier_cache_lock:
        classifier = _classifier_cache.get(key)
        if classifier is None:
            try:
                classifier = EventClassifier.from_provider_config(
                    provider_name=provider_name,
                    model=model,
                    api_key=api_key,
                    base_url=base_url,
                    cache_path=cache_path,
                    audit_path=audit_path,
                    enable_cache=True,
                    enable_audit=True,
                )
            except (RuntimeError, ValueError) as exc:
                raise HTTPException(
                    status_code=503,
                    detail=f"Failed to initialize LLM provider '{provider_name}': {exc}",
                ) from exc
            _classifier_cache[key] = classifier

    if not classifier.is_available():
        reason = classifier.availability_error or "unknown"
        raise HTTPException(
            status_code=503,
            detail=f"LLM provider '{provider_name}' model '{model_key}' is unavailable: {reason}",
        )

    return classifier


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
    service: IntelligenceService = Depends(get_intelligence_service),
):
    return service.get_events(asof_date=asof_date, symbols=symbols)


@router.post("/classify", response_model=LLMClassifyNewsResponse)
def classify_news(request: LLMClassifyNewsRequest):
    """Classify financial news headlines using LLM.
    
    Args:
        request: Classification request with headlines and provider settings
    
    Returns:
        Classified events with metadata
    
    Raises:
        HTTPException: If LLM provider is unavailable or classification fails
    """
    # Get or create singleton classifier (prevents file handle leaks)
    try:
        classifier = get_or_create_classifier(request.provider, request.model)
    except HTTPException:
        # Re-raise HTTPException as-is
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize LLM provider: {str(e)}"
        )
    
    # Classify all headlines
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
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Classification failed: {str(e)}"
        )
    
    # Compute statistics
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
        provider_available=classifier.is_available(),
    )
