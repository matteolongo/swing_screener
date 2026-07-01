"""Symbol pool API: taxonomy-filtered browse, review queue, presets."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_review_queue_repo, get_symbol_pool_repo
from api.models.screener import TaxonomyFilter
from api.repositories.review_queue_repo import ReviewQueueRepository
from api.repositories.symbol_pool_repo import SymbolPoolRepository
from api.services.pool_admin_service import (
    PoolBusyError,
    get_enrich_status,
    rebuild_pool,
    start_enrich_job,
)
from api.services.pool_service import list_pool_symbols, load_taxonomy_presets

router = APIRouter()


@router.get("/symbols")
def get_symbols(
    region: Optional[list[str]] = Query(default=None),
    market_cap_tier: Optional[list[str]] = Query(default=None),
    sector: Optional[list[str]] = Query(default=None),
    index_memberships: Optional[list[str]] = Query(default=None),
    instrument_type_detail: Optional[list[str]] = Query(default=None),
    provider: Optional[list[str]] = Query(default=None),
    currency: Optional[list[str]] = Query(default=None),
    exchange_mics: Optional[list[str]] = Query(default=None),
    liquidity_tier: Optional[list[str]] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=1000),
    repo: SymbolPoolRepository = Depends(get_symbol_pool_repo),
):
    tf = TaxonomyFilter(
        region=region,
        market_cap_tier=market_cap_tier,
        sector=sector,
        index_memberships=index_memberships,
        instrument_type_detail=instrument_type_detail,
        provider=provider,
        currency=currency,
        exchange_mics=exchange_mics,
        liquidity_tier=liquidity_tier,
    )
    return list_pool_symbols(repo, tf, page, page_size)


@router.get("/review-queue")
def get_review_queue(repo: ReviewQueueRepository = Depends(get_review_queue_repo)):
    from swing_screener.data.symbol_pool import load_symbol_pool_thresholds

    _, _, threshold = load_symbol_pool_thresholds()
    return {"entries": repo.list_entries(threshold)}


@router.post("/review-queue/{symbol}/remove")
def remove_from_pool(
    symbol: str, repo: ReviewQueueRepository = Depends(get_review_queue_repo)
):
    return {"removed": repo.remove(symbol)}


@router.post("/review-queue/{symbol}/restore")
def restore_to_pool(
    symbol: str, repo: ReviewQueueRepository = Depends(get_review_queue_repo)
):
    restored = repo.restore(symbol)
    return {"restored": restored is not None}


@router.get("/presets")
def get_presets():
    return {"presets": load_taxonomy_presets()}


@router.post("/rebuild")
def rebuild(repo: SymbolPoolRepository = Depends(get_symbol_pool_repo)):
    try:
        return rebuild_pool(repo)
    except PoolBusyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail="Failed to rebuild symbol pool"
        ) from exc


@router.post("/enrich")
def enrich(repo: SymbolPoolRepository = Depends(get_symbol_pool_repo)):
    try:
        return {"job_id": start_enrich_job(repo)}
    except PoolBusyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/enrich/{job_id}")
def enrich_status(job_id: str):
    status = get_enrich_status(job_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Enrichment job not found.")
    return status
