from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from swing_screener.data.universe import (
    get_package_universe_detail,
    list_package_universe_entries,
    refresh_package_universe,
    update_package_universe_benchmark,
)
from swing_screener.data.universe_sources import UniverseSourceError


router = APIRouter()


class UniverseRefreshRequest(BaseModel):
    apply: bool = False


class UniverseBenchmarkRequest(BaseModel):
    benchmark: str


@router.get("")
async def list_universes():
    try:
        return {"universes": list_package_universe_entries()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to list universes") from exc


@router.get("/{universe_id}")
async def get_universe(universe_id: str):
    try:
        return get_package_universe_detail(universe_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to load universe detail") from exc


@router.post("/{universe_id}/refresh")
async def refresh_universe(universe_id: str, request: UniverseRefreshRequest):
    try:
        return refresh_package_universe(universe_id, apply=request.apply)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except UniverseSourceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to refresh universe") from exc


@router.post("/{universe_id}/benchmark")
async def update_universe_benchmark(universe_id: str, request: UniverseBenchmarkRequest):
    try:
        return update_package_universe_benchmark(universe_id, request.benchmark)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to update universe benchmark") from exc
