"""Portfolio router - Positions CRUD and local order management."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from api.models.portfolio import (
    Position,
    PositionUpdate,
    PositionsWithMetricsResponse,
    PositionMetrics,
    PortfolioSummary,
    CreateOrderRequest,
    CreatePositionRequest,
    FillOrderRequest,
    FillOrderResponse,
    UpdateStopRequest,
    UpdateTrailMethodRequest,
    ClosePositionRequest,
    PartialCloseRequest,
    StopSuggestionComputeRequest,
    EarningsProximityResponse,
    RegimeBreakdownResponse,
)
from api.dependencies import get_config_repo, get_orders_service, get_portfolio_service, get_regime_analytics_service
from api.dependencies import get_strategy_repo
from api.repositories.config_repo import ConfigRepository
from api.repositories.strategy_repo import StrategyRepository
from api.services.orders_service import OrdersService
from api.services.portfolio_service import PortfolioService
from api.services.regime_analytics import RegimeAnalyticsService

router = APIRouter()


# ===== Positions =====

@router.get("/positions", response_model=PositionsWithMetricsResponse)
async def get_positions(
    status: Optional[str] = None,
    service: PortfolioService = Depends(get_portfolio_service),
    config_repo: ConfigRepository = Depends(get_config_repo),
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
):
    """Get all positions, optionally filtered by status."""
    manage = config_repo.get().manage
    time_stop_days = int(manage.time_stop_days)
    time_stop_min_r = float(manage.time_stop_min_r)
    try:
        active_strategy = strategy_repo.get_active_strategy()
        strategy_manage = active_strategy.get("manage", {})
        time_stop_days = int(strategy_manage.get("time_stop_days", time_stop_days))
        time_stop_min_r = float(strategy_manage.get("time_stop_min_r", time_stop_min_r))
    except (TypeError, ValueError):
        pass
    return service.list_positions(
        status=status,
        time_stop_days=time_stop_days,
        time_stop_min_r=time_stop_min_r,
    )


@router.post("/positions", response_model=Position)
async def create_position(
    request: CreatePositionRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Register a position manually after a DeGiro fill."""
    return service.create_position(request)


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


@router.get("/positions/{position_id}/stop-preview", response_model=PositionUpdate)
async def get_position_stop_preview(
    position_id: str,
    price: Optional[float] = Query(default=None, gt=0),
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Intraday stop rule preview using live or user-supplied price."""
    return service.suggest_stop_intraday(position_id, price=price)


@router.patch("/positions/{position_id}/trail-method")
async def update_position_trail_method(
    position_id: str,
    request: UpdateTrailMethodRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Update trail stop method for an open position."""
    return service.update_trail_method(position_id, request)


@router.post("/stop-suggestion/compute", response_model=PositionUpdate)
async def compute_position_stop_suggestion(
    request: StopSuggestionComputeRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Compute stop suggestion from client-provided state without repository persistence."""
    return service.compute_position_stop_suggestion(
        request.position.model_dump(),
        request.manage.model_dump() if request.manage else None,
    )


@router.post("/positions/{position_id}/close")
async def close_position(
    position_id: str,
    request: ClosePositionRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Close a position."""
    return service.close_position(position_id, request)


@router.post("/positions/{position_id}/partial-close")
async def partial_close_position(
    position_id: str,
    request: PartialCloseRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Partially close an open position by closing a subset of shares."""
    return service.partial_close_position(position_id, request)


@router.get("/summary", response_model=PortfolioSummary)
async def get_portfolio_summary(
    service: PortfolioService = Depends(get_portfolio_service),
    config_repo: ConfigRepository = Depends(get_config_repo),
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
):
    """Get aggregated portfolio metrics for all open positions."""
    config_account_size = float(config_repo.get().risk.account_size)
    account_size_mode = getattr(config_repo.get().risk, "account_size_mode", "equity")
    default_config_account_size = float(ConfigRepository.get_defaults().risk.account_size)
    account_size = config_account_size

    if abs(config_account_size - default_config_account_size) <= 1e-9:
        try:
            active_strategy = strategy_repo.get_active_strategy()
            strategy_account_size = float(active_strategy.get("risk", {}).get("account_size", 0.0))
            if strategy_account_size > 0:
                account_size = strategy_account_size
                account_size_mode = str(active_strategy.get("risk", {}).get("account_size_mode", account_size_mode))
        except (TypeError, ValueError):
            pass

    return service.get_portfolio_summary(account_size=account_size, account_size_mode=account_size_mode)


@router.get("/earnings-proximity/{ticker}", response_model=EarningsProximityResponse)
async def get_earnings_proximity(
    ticker: str,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Check whether a ticker has earnings within the warning window."""
    return service.get_earnings_proximity(ticker)


@router.get("/analytics/regime-breakdown", response_model=RegimeBreakdownResponse)
async def get_regime_breakdown(
    service: RegimeAnalyticsService = Depends(get_regime_analytics_service),
) -> RegimeBreakdownResponse:
    """Return closed-position performance grouped by market regime at entry date."""
    result = service.get_regime_breakdown()
    return RegimeBreakdownResponse(**result)


# ===== Orders =====

@router.post("/orders", status_code=201)
async def create_order(
    request: CreateOrderRequest,
    service: OrdersService = Depends(get_orders_service),
):
    """Create a pending entry order."""
    return service.create_order(request)


@router.get("/orders/local")
async def list_local_orders(
    status: Optional[str] = None,
    service: OrdersService = Depends(get_orders_service),
):
    """List locally stored pending/filled orders from orders.json."""
    return service.list_local_orders(status=status)


@router.delete("/orders/{order_id}")
async def cancel_order(
    order_id: str,
    service: OrdersService = Depends(get_orders_service),
):
    """Cancel a pending local order."""
    return service.cancel_order(order_id)


@router.post("/orders/{order_id}/fill", status_code=201, response_model=FillOrderResponse)
async def fill_order(
    order_id: str,
    request: FillOrderRequest,
    service: OrdersService = Depends(get_orders_service),
):
    """Mark a pending order as filled and create an open position."""
    return service.fill_order(order_id, request)



