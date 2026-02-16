"""Market intelligence router."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_intelligence_service
from api.models.intelligence import (
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


# Singleton classifier cache to reuse instances and avoid file handle leaks
# Key: (provider, model), Value: EventClassifier instance
_classifier_cache: dict[tuple[str, str], Any] = {}


def get_or_create_classifier(provider_name: str, model: str) -> Any:
    """Get or create a singleton EventClassifier for the given provider and model.
    
    This prevents file handle leaks from creating new classifier instances on each request.
    Classifiers are cached per (provider, model) combination.
    """
    from swing_screener.intelligence.llm import (
        EventClassifier,
        MockLLMProvider,
        OllamaProvider,
    )
    
    cache_key = (provider_name, model)
    
    if cache_key not in _classifier_cache:
        # Initialize provider
        if provider_name == "mock":
            provider = MockLLMProvider()
        elif provider_name == "ollama":
            try:
                provider = OllamaProvider(model=model)
            except RuntimeError as e:
                # ollama package not installed
                raise HTTPException(
                    status_code=503,
                    detail=str(e)
                )
            
            if not provider.is_available():
                raise HTTPException(
                    status_code=503,
                    detail=f"Ollama model '{model}' not available. "
                           f"Ensure Ollama is running and model is pulled."
                )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown provider: {provider_name}. Use 'ollama' or 'mock'."
            )
        
        # Create and cache classifier
        _classifier_cache[cache_key] = EventClassifier(provider=provider)
    
    return _classifier_cache[cache_key]


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
        provider_available=classifier.provider.is_available(),
    )
