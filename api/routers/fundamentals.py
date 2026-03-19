"""Fundamentals router."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_fundamentals_service
from api.models.fundamentals import (
    FundamentalRefreshRequest,
    FundamentalSnapshotResponse,
    FundamentalsCompareRequest,
    FundamentalsCompareResponse,
    FundamentalsConfigModel,
)
from api.services.fundamentals_service import FundamentalsService

router = APIRouter()


@router.get("/config", response_model=FundamentalsConfigModel)
def get_config(
    service: FundamentalsService = Depends(get_fundamentals_service),
):
    return service.get_config()


@router.put("/config", response_model=FundamentalsConfigModel)
def update_config(
    request: FundamentalsConfigModel,
    service: FundamentalsService = Depends(get_fundamentals_service),
):
    try:
        return service.update_config(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/snapshot/{symbol}", response_model=FundamentalSnapshotResponse)
def get_snapshot(
    symbol: str,
    refresh: bool = Query(default=False),
    service: FundamentalsService = Depends(get_fundamentals_service),
):
    try:
        return service.get_snapshot(symbol, force_refresh=refresh)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/refresh", response_model=FundamentalSnapshotResponse)
def refresh_snapshot(
    request: FundamentalRefreshRequest,
    service: FundamentalsService = Depends(get_fundamentals_service),
):
    try:
        return service.refresh_snapshot(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/compare", response_model=FundamentalsCompareResponse)
def compare_fundamentals(
    request: FundamentalsCompareRequest,
    service: FundamentalsService = Depends(get_fundamentals_service),
):
    try:
        return service.compare(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
