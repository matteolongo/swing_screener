"""Strategy router - CRUD for strategy definitions."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from api.models.strategy import (
    Strategy,
    StrategyCreateRequest,
    StrategyUpdateRequest,
    ActiveStrategyRequest,
    StrategyValidationResult,
    ValidationWarningModel,
)
from api.dependencies import get_strategy_service
from api.services.strategy_service import StrategyService
from swing_screener.strategies.validation import validate_strategy_full

router = APIRouter()
logger = logging.getLogger(__name__)


def _build_validation_result(strategy_payload: dict) -> StrategyValidationResult:
    warnings, score, level = validate_strategy_full(strategy_payload)
    danger_count = sum(1 for warning in warnings if warning.level == "danger")
    warning_count = sum(1 for warning in warnings if warning.level == "warning")
    info_count = sum(1 for warning in warnings if warning.level == "info")
    return StrategyValidationResult(
        is_valid=danger_count == 0,
        warnings=[
            ValidationWarningModel(
                parameter=warning.parameter,
                level=warning.level,
                message=warning.message,
            )
            for warning in warnings
        ],
        safety_score=score,
        safety_level=level,
        total_warnings=len(warnings),
        danger_count=danger_count,
        warning_count=warning_count,
        info_count=info_count,
    )


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


@router.post("/validate", response_model=StrategyValidationResult)
async def validate_strategy(
    request: StrategyUpdateRequest,
) -> StrategyValidationResult:
    """Validate strategy settings and return warnings with safety score."""
    return _build_validation_result(request.model_dump())


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
    validation = _build_validation_result(request.model_dump())
    if validation.danger_count > 0:
        logger.warning(
            "Creating strategy '%s' with %s danger warnings (score=%s, level=%s).",
            request.id,
            validation.danger_count,
            validation.safety_score,
            validation.safety_level,
        )
    return service.create_strategy(request)


@router.put("/{strategy_id}", response_model=Strategy)
async def update_strategy(
    strategy_id: str,
    request: StrategyUpdateRequest,
    service: StrategyService = Depends(get_strategy_service),
):
    """Update an existing strategy."""
    validation = _build_validation_result(request.model_dump())
    if validation.danger_count > 0:
        logger.warning(
            "Updating strategy '%s' with %s danger warnings (score=%s, level=%s).",
            strategy_id,
            validation.danger_count,
            validation.safety_score,
            validation.safety_level,
        )
    return service.update_strategy(strategy_id, request)


@router.delete("/{strategy_id}")
async def delete_strategy(
    strategy_id: str,
    service: StrategyService = Depends(get_strategy_service),
):
    """Delete a strategy (default strategy cannot be removed)."""
    return service.delete_strategy(strategy_id)
