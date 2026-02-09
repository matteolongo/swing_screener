"""Strategy router - CRUD for strategy definitions."""
from __future__ import annotations

import datetime as dt
from fastapi import APIRouter, HTTPException

from api.models import (
    Strategy,
    StrategyCreateRequest,
    StrategyUpdateRequest,
    ActiveStrategyRequest,
)
from swing_screener.strategy.storage import (
    DEFAULT_STRATEGY_ID,
    load_strategies,
    save_strategies,
    load_active_strategy_id,
    set_active_strategy_id,
    get_active_strategy,
    get_strategy_by_id,
)

router = APIRouter()


def _now_iso() -> str:
    return dt.datetime.now().replace(microsecond=0).isoformat()


def _require_strategy(strategy_id: str) -> dict:
    strategy = get_strategy_by_id(strategy_id)
    if strategy is None:
        raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")
    return strategy


@router.get("", response_model=list[Strategy])
async def list_strategies():
    """List all strategies."""
    return load_strategies()


@router.get("/active", response_model=Strategy)
async def get_active():
    """Get the active strategy."""
    return get_active_strategy()


@router.post("/active", response_model=Strategy)
async def set_active(request: ActiveStrategyRequest):
    """Set the active strategy by ID."""
    strategy = _require_strategy(request.strategy_id)
    set_active_strategy_id(request.strategy_id)
    return strategy


@router.get("/{strategy_id}", response_model=Strategy)
async def get_strategy(strategy_id: str):
    """Get a strategy by ID."""
    return _require_strategy(strategy_id)


@router.post("", response_model=Strategy)
async def create_strategy(request: StrategyCreateRequest):
    """Create a new strategy."""
    if request.id == DEFAULT_STRATEGY_ID:
        raise HTTPException(status_code=400, detail="Cannot create strategy with reserved id 'default'.")

    strategies = load_strategies()
    if any(s.get("id") == request.id for s in strategies):
        raise HTTPException(status_code=409, detail=f"Strategy already exists: {request.id}")

    ts = _now_iso()
    payload = request.model_dump()
    payload["is_default"] = False
    payload["created_at"] = ts
    payload["updated_at"] = ts

    strategies.append(payload)
    save_strategies(strategies)
    return payload


@router.put("/{strategy_id}", response_model=Strategy)
async def update_strategy(strategy_id: str, request: StrategyUpdateRequest):
    """Update an existing strategy."""
    strategies = load_strategies()
    ts = _now_iso()

    for idx, strategy in enumerate(strategies):
        if strategy.get("id") != strategy_id:
            continue

        updated = request.model_dump()
        updated["id"] = strategy_id
        updated["is_default"] = bool(strategy.get("is_default", False))
        updated["created_at"] = strategy.get("created_at", ts)
        updated["updated_at"] = ts

        strategies[idx] = updated
        save_strategies(strategies)
        return updated

    raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")


@router.delete("/{strategy_id}")
async def delete_strategy(strategy_id: str):
    """Delete a strategy (default strategy cannot be removed)."""
    strategies = load_strategies()

    if strategy_id == DEFAULT_STRATEGY_ID:
        raise HTTPException(status_code=400, detail="Default strategy cannot be deleted.")

    active_id = load_active_strategy_id()

    kept: list[dict] = []
    removed = False
    for strategy in strategies:
        if strategy.get("id") == strategy_id:
            if strategy.get("is_default"):
                raise HTTPException(status_code=400, detail="Default strategy cannot be deleted.")
            removed = True
            continue
        kept.append(strategy)

    if not removed:
        raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")

    save_strategies(kept)

    if active_id == strategy_id:
        set_active_strategy_id(DEFAULT_STRATEGY_ID)

    return {"status": "deleted", "id": strategy_id}
