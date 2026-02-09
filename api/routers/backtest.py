"""Backtest router - Quick backtest for individual tickers."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from api.models.backtest import (
    QuickBacktestRequest,
    QuickBacktestResponse,
    FullBacktestRequest,
    FullBacktestResponse,
    BacktestSimulationMeta,
    BacktestSimulation,
)
from api.dependencies import get_backtest_service
from api.services.backtest_service import BacktestService

router = APIRouter()


@router.post("/quick", response_model=QuickBacktestResponse)
async def quick_backtest(
    request: QuickBacktestRequest,
    service: BacktestService = Depends(get_backtest_service),
):
    """
    Run a quick backtest on a single ticker.

    Auto-detects entry type if not specified.
    Uses default backtest parameters unless overridden.
    Returns summary statistics and trade details.
    """
    return service.quick_backtest(request)


@router.post("/run", response_model=FullBacktestResponse)
async def run_full_backtest(
    request: FullBacktestRequest,
    service: BacktestService = Depends(get_backtest_service),
):
    """
    Run a full backtest on one or more tickers and persist the results to disk.
    """
    return service.run_full_backtest(request)


@router.get("/simulations", response_model=list[BacktestSimulationMeta])
async def list_backtest_simulations(service: BacktestService = Depends(get_backtest_service)):
    return service.list_simulations()


@router.get("/simulations/{sim_id}", response_model=BacktestSimulation)
async def get_backtest_simulation(
    sim_id: str,
    service: BacktestService = Depends(get_backtest_service),
):
    return service.get_simulation(sim_id)


@router.delete("/simulations/{sim_id}")
async def delete_backtest_simulation(
    sim_id: str,
    service: BacktestService = Depends(get_backtest_service),
):
    return service.delete_simulation(sim_id)
