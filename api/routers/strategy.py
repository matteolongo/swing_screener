"""Strategy router - CRUD for strategy definitions."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from api.models.strategy import (
    Strategy,
    StrategyCreateRequest,
    StrategyUpdateRequest,
    ActiveStrategyRequest,
)
from api.dependencies import get_strategy_service
from api.services.strategy_service import StrategyService

router = APIRouter()


@router.get("", response_model=list[Strategy])
async def list_strategies(service: StrategyService = Depends(get_strategy_service)):
    """List all strategies."""
    return service.list_strategies()


@router.get("/active", response_model=Strategy)
async def get_active(service: StrategyService = Depends(get_strategy_service)):
    """Get the active strategy."""
    return service.get_active_strategy()


@router.post("/active", response_model=Strategy)
async def set_active(
    request: ActiveStrategyRequest,
    service: StrategyService = Depends(get_strategy_service),
):
    """Set the active strategy by ID."""
    return service.set_active_strategy(request)


@router.get("/{strategy_id}", response_model=Strategy)
async def get_strategy(
    strategy_id: str,
    service: StrategyService = Depends(get_strategy_service),
):
    """Get a strategy by ID."""
    return service.get_strategy(strategy_id)


@router.post("", response_model=Strategy)
async def create_strategy(
    request: StrategyCreateRequest,
    service: StrategyService = Depends(get_strategy_service),
):
    """Create a new strategy."""
    return service.create_strategy(request)


@router.put("/{strategy_id}", response_model=Strategy)
async def update_strategy(
    strategy_id: str,
    request: StrategyUpdateRequest,
    service: StrategyService = Depends(get_strategy_service),
):
    """Update an existing strategy."""
    return service.update_strategy(strategy_id, request)


@router.delete("/{strategy_id}")
async def delete_strategy(
    strategy_id: str,
    service: StrategyService = Depends(get_strategy_service),
):
    """Delete a strategy (default strategy cannot be removed)."""
    return service.delete_strategy(strategy_id)
