"""Screener router - Run screener and preview orders."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from api.models.screener import ScreenerRequest, ScreenerResponse, OrderPreview
from api.dependencies import get_screener_service
from api.services.screener_service import ScreenerService

router = APIRouter()


@router.get("/universes")
async def list_universes(service: ScreenerService = Depends(get_screener_service)):
    """List available universe files."""
    return service.list_universes()


@router.post("/run", response_model=ScreenerResponse)
async def run_screener(
    request: ScreenerRequest,
    service: ScreenerService = Depends(get_screener_service),
):
    """Run the screener on a universe of stocks."""
    return service.run_screener(request)


@router.post("/preview-order", response_model=OrderPreview)
async def preview_order(
    ticker: str,
    entry_price: float,
    stop_price: float,
    account_size: float = 50000,
    risk_pct: float = 0.01,
    service: ScreenerService = Depends(get_screener_service),
):
    """Preview order calculations (shares, position size, risk)."""
    return service.preview_order(
        ticker=ticker,
        entry_price=entry_price,
        stop_price=stop_price,
        account_size=account_size,
        risk_pct=risk_pct,
    )
