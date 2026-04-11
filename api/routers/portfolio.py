"""Portfolio router - Positions CRUD and live DeGiro order reads."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends

from api.models.portfolio import (
    Position,
    PositionUpdate,
    PositionsWithMetricsResponse,
    PositionMetrics,
    PortfolioSummary,
    DegiroOrder,
    DegiroOrdersResponse,
    CreatePositionRequest,
    UpdateStopRequest,
    ClosePositionRequest,
    StopSuggestionComputeRequest,
    DegiroSyncRequest,
    DegiroSyncPreviewResponse,
    DegiroApplyResponse,
    DegiroStatus,
)
from api.dependencies import get_config_repo, get_portfolio_service
from api.dependencies import get_strategy_repo
from api.repositories.config_repo import ConfigRepository
from api.repositories.strategy_repo import StrategyRepository
from api.services.portfolio_service import PortfolioService

router = APIRouter()


# ===== Positions =====

@router.get("/positions", response_model=PositionsWithMetricsResponse)
async def get_positions(
    status: Optional[str] = None,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Get all positions, optionally filtered by status."""
    return service.list_positions(status=status)


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


@router.get("/summary", response_model=PortfolioSummary)
async def get_portfolio_summary(
    service: PortfolioService = Depends(get_portfolio_service),
    config_repo: ConfigRepository = Depends(get_config_repo),
    strategy_repo: StrategyRepository = Depends(get_strategy_repo),
):
    """Get aggregated portfolio metrics for all open positions."""
    config_account_size = float(config_repo.get().risk.account_size)
    default_config_account_size = float(ConfigRepository.get_defaults().risk.account_size)
    account_size = config_account_size

    if abs(config_account_size - default_config_account_size) <= 1e-9:
        try:
            active_strategy = strategy_repo.get_active_strategy()
            strategy_account_size = float(active_strategy.get("risk", {}).get("account_size", 0.0))
            if strategy_account_size > 0:
                account_size = strategy_account_size
        except (TypeError, ValueError):
            pass

    return service.get_portfolio_summary(account_size=account_size)


# ===== Orders (live read from DeGiro) =====

@router.get("/orders", response_model=DegiroOrdersResponse)
async def get_orders(
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Get live orders from DeGiro API (read-only).

    Returns 503 if degiro-connector is missing or credentials are absent.
    """
    _check_degiro_available()
    return service.list_degiro_orders()


# ===== DeGiro Integration =====

def _get_degiro_status() -> DegiroStatus:
    import importlib.util

    if importlib.util.find_spec("degiro_connector") is None:
        return DegiroStatus(
            installed=False,
            credentials_configured=False,
            available=False,
            mode="missing_library",
            detail=(
                "degiro-connector is not installed. Install it with: pip install -e '.[degiro]'. "
                "The rest of the app still works, but DeGiro sync and audits stay unavailable."
            ),
        )
    try:
        from swing_screener.integrations.degiro.credentials import load_credentials

        load_credentials()
    except ValueError as exc:
        return DegiroStatus(
            installed=True,
            credentials_configured=False,
            available=False,
            mode="missing_credentials",
            detail=(
                f"{exc} The rest of the app still works, but DeGiro sync and audits stay unavailable."
            ),
        )

    return DegiroStatus(
        installed=True,
        credentials_configured=True,
        available=True,
        mode="ready",
        detail="DeGiro sync and audits are available.",
    )


def _check_degiro_available() -> None:
    from fastapi import HTTPException

    status = _get_degiro_status()
    if not status.available:
        raise HTTPException(status_code=503, detail=status.detail)


@router.get("/degiro/status", response_model=DegiroStatus)
async def get_degiro_status():
    """Report whether optional DeGiro sync/audit features are usable."""
    return _get_degiro_status()


@router.post("/sync/degiro/preview", response_model=DegiroSyncPreviewResponse)
async def degiro_sync_preview(
    request: DegiroSyncRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Preview DeGiro portfolio position sync — computes diffs without writing anything.

    Returns 503 if degiro-connector is missing or credentials are absent.
    """
    _check_degiro_available()

    from swing_screener.integrations.degiro.credentials import load_credentials
    from swing_screener.integrations.degiro.client import DegiroClient
    from swing_screener.integrations.degiro import sync as degiro_sync

    credentials = load_credentials()

    with DegiroClient(credentials) as client:
        raw_data = degiro_sync.fetch_live_data(
            client,
            request.from_date,
            request.to_date,
            include_portfolio=request.include_portfolio,
            include_orders_history=False,
            include_transactions=request.include_transactions,
        )

    sync_raw = degiro_sync.normalize(raw_data)

    positions_resp = service.list_positions()
    local_positions = [p.model_dump() for p in positions_resp.positions]

    preview = degiro_sync.preview(sync_raw, local_positions)

    def _diff_list(diffs):
        return [
            {
                "kind": d.kind,
                "action": d.action,
                "local_id": d.local_id,
                "broker_id": d.broker_id,
                "confidence": d.confidence,
                "fields": d.fields,
            }
            for d in diffs
        ]

    return DegiroSyncPreviewResponse(
        positions_to_create=_diff_list(preview.positions_to_create),
        positions_to_update=_diff_list(preview.positions_to_update),
        orders_to_create=[],
        orders_to_update=[],
        fees_applied=0,
        ambiguous=[],
        unmatched=[],
    )


@router.post("/sync/degiro/apply", response_model=DegiroApplyResponse)
async def degiro_sync_apply(
    request: DegiroSyncRequest,
    service: PortfolioService = Depends(get_portfolio_service),
):
    """Apply DeGiro portfolio sync — updates local positions to match broker state.

    Returns 503 if degiro-connector is missing or credentials are absent.
    """
    _check_degiro_available()

    from swing_screener.integrations.degiro.credentials import load_credentials
    from swing_screener.integrations.degiro.client import DegiroClient
    from swing_screener.integrations.degiro import sync as degiro_sync
    from api.utils.files import get_today_str

    credentials = load_credentials()

    with DegiroClient(credentials) as client:
        raw_data = degiro_sync.fetch_live_data(
            client,
            request.from_date,
            request.to_date,
            include_portfolio=request.include_portfolio,
            include_orders_history=False,
            include_transactions=request.include_transactions,
        )

    sync_raw = degiro_sync.normalize(raw_data)

    positions_resp = service.list_positions()
    local_positions = [p.model_dump() for p in positions_resp.positions]

    preview = degiro_sync.preview(sync_raw, local_positions)

    # Apply position updates to the repository
    positions_updated = 0
    ambiguous_skipped = 0

    data = service._positions_repo.read()
    positions = data.get("positions", [])

    for diff in preview.positions_to_update:
        if not diff.local_id:
            ambiguous_skipped += 1
            continue
        for pos in positions:
            if pos.get("position_id") == diff.local_id:
                pos.update(diff.fields)
                positions_updated += 1
                break

    if positions_updated > 0:
        data["asof"] = get_today_str()
        service._positions_repo.write(data)

    return DegiroApplyResponse(
        positions_created=0,
        positions_updated=positions_updated,
        orders_created=0,
        orders_updated=positions_updated,  # frontend uses orders_updated to show "N updated"
        fees_applied=0,
        ambiguous_skipped=ambiguous_skipped,
    )
