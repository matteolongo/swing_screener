"""Fundamentals router."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from api.dependencies import get_fundamentals_service
from api.models.fundamentals import (
    FundamentalRefreshRequest,
    FundamentalSnapshotResponse,
)
from api.services.fundamentals_service import FundamentalsService

router = APIRouter()


@router.get("/snapshot/{symbol}", response_model=FundamentalSnapshotResponse)
def get_snapshot(
    symbol: str,
    refresh: bool = Query(default=False),
    service: FundamentalsService = Depends(get_fundamentals_service),
):
    return service.get_snapshot(symbol, force_refresh=refresh)


@router.post("/refresh", response_model=FundamentalSnapshotResponse)
def refresh_snapshot(
    request: FundamentalRefreshRequest,
    service: FundamentalsService = Depends(get_fundamentals_service),
):
    return service.refresh_snapshot(request)
