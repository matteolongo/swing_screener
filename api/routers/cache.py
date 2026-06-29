"""Cache management endpoints: status introspection and clear operations."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_cache_service
from api.models.cache import CacheStatusEntry, CacheClearResponse
from api.services.cache_service import CacheService

router = APIRouter(tags=["cache"])


@router.get("/status", response_model=list[CacheStatusEntry])
def get_cache_status(service: CacheService = Depends(get_cache_service)) -> list[CacheStatusEntry]:
    return service.status()


@router.post("/clear/{cache_id}", response_model=CacheClearResponse)
def clear_cache(cache_id: str, service: CacheService = Depends(get_cache_service)) -> CacheClearResponse:
    try:
        service.clear(cache_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return CacheClearResponse(cleared=True, cache_id=cache_id)
