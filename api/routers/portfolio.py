"""Portfolio router - Positions and Orders CRUD."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends

from api.models.portfolio import (
    Position,
    PositionUpdate,
    PositionMetrics,
    PortfolioSummary,
    Order,
    PositionsResponse,
    OrdersResponse,
    OrdersSnapshotResponse,
    CreateOrderRequest,
    FillOrderRequest,
    UpdateStopRequest,
    ClosePositionRequest,
)
from api.dependencies import get_config_repo, get_portfolio_service
from api.repositories.config_repo import ConfigRepository
from api.services.portfolio_service import PortfolioService

router = APIRouter()


# ===== Positions =====

@router.get("/positions", response_model=PositionsResponse)
async def get_positions(
    status: Optional[str] = None,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Get all positions, optionally filtered by status."""
    return service.list_positions(status=status)


@router.get("/positions/{position_id}", response_model=Position)
async def get_position(
    position_id: str,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Get a specific position by ID."""
    return service.get_position(position_id)


@router.get("/positions/{position_id}/metrics", response_model=PositionMetrics)
async def get_position_metrics(
    position_id: str,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Get authoritative calculated metrics for a specific position."""
    return service.get_position_metrics(position_id)


@router.put("/positions/{position_id}/stop")
async def update_position_stop(
    position_id: str,
    request: UpdateStopRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Update stop price for a position."""
    return service.update_position_stop(position_id, request)


@router.get("/positions/{position_id}/stop-suggestion", response_model=PositionUpdate)
async def get_position_stop_suggestion(
    position_id: str,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Get suggested stop price for a position based on manage rules."""
    return service.suggest_position_stop(position_id)


@router.post("/positions/{position_id}/close")
async def close_position(
    position_id: str,
    request: ClosePositionRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Close a position."""
    return service.close_position(position_id, request)


@router.get("/summary", response_model=PortfolioSummary)
async def get_portfolio_summary(
    service: PortfolioService = Depends(get_portfolio_service),
    config_repo: ConfigRepository = Depends(get_config_repo),
):
    """Get aggregated portfolio metrics for all open positions."""
    account_size = float(config_repo.get().risk.account_size)
    return service.get_portfolio_summary(account_size=account_size)


# ===== Orders =====

@router.get("/orders", response_model=OrdersResponse)
async def get_orders(
    status: Optional[str] = None,
    ticker: Optional[str] = None,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Get all orders, optionally filtered by status or ticker."""
    return service.list_orders(status=status, ticker=ticker)


@router.get("/orders/snapshot", response_model=OrdersSnapshotResponse)
async def get_orders_snapshot(
    status: Optional[str] = "pending",
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Get orders with latest close and distance to limit/stop."""
    return service.list_order_snapshots(status=status)


@router.get("/orders/{order_id}", response_model=Order)
async def get_order(
    order_id: str,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Get a specific order by ID."""
    return service.get_order(order_id)


@router.post("/orders", response_model=Order)
async def create_order(
    request: CreateOrderRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Create a new order."""
    return service.create_order(request)


@router.post("/orders/{order_id}/fill")
async def fill_order(
    order_id: str,
    request: FillOrderRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Fill an order."""
    return service.fill_order(order_id, request)


@router.delete("/orders/{order_id}")
async def cancel_order(
    order_id: str,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Cancel an order."""
    return service.cancel_order(order_id)
