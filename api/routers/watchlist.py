"""Watchlist router."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

from api.dependencies import get_portfolio_service, get_watchlist_repo, get_watchlist_service
from api.models.watchlist import (
    WatchItem,
    WatchItemUpsertRequest,
    WatchlistDeleteResponse,
    WatchlistPipelineResponse,
    WatchlistResponse,
)
from api.repositories.watchlist_repo import WatchlistRepository
from api.services.portfolio_service import PortfolioService
from api.services.watchlist_service import WatchlistService

router = APIRouter()


@router.get("", response_model=WatchlistResponse)
async def list_watchlist(
    service: WatchlistService = Depends(get_watchlist_service),
):
    return WatchlistResponse(items=service.list_items())


@router.get("/pipeline", response_model=WatchlistPipelineResponse)
async def get_watchlist_pipeline(
    repo: WatchlistRepository = Depends(get_watchlist_repo),
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Return watchlist items enriched with current price and distance to trigger zone."""
    items = repo.list_items()
    return service.compute_watchlist_pipeline(items)


@router.put("/{ticker}", response_model=WatchItem)
async def upsert_watchlist_item(
    ticker: str,
    request: WatchItemUpsertRequest,
    repo: WatchlistRepository = Depends(get_watchlist_repo),
):
    try:
        return repo.upsert_item(ticker, request)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=exc.errors(include_url=False, include_context=False),
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/{ticker}", response_model=WatchlistDeleteResponse)
async def delete_watchlist_item(
    ticker: str,
    repo: WatchlistRepository = Depends(get_watchlist_repo),
):
    normalized_ticker = ticker.strip().upper()
    if not normalized_ticker:
        raise HTTPException(status_code=422, detail="Invalid ticker")
    deleted = repo.delete_item(normalized_ticker)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Watch item not found: {normalized_ticker}",
        )
    return WatchlistDeleteResponse(deleted=True)
