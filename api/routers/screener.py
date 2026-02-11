"""Screener router - Run screener and preview orders."""
from __future__ import annotations

import math
from fastapi import APIRouter, Depends, HTTPException

from api.models.screener import ScreenerRequest, ScreenerResponse, OrderPreview
from api.dependencies import get_screener_service
from api.services.screener_service import ScreenerService
from pydantic import BaseModel, Field, field_validator

router = APIRouter()


class OrderPreviewRequest(BaseModel):
    """Request model for order preview with validation."""
    ticker: str
    entry_price: float
    stop_price: float
    account_size: float = Field(default=50000, gt=0, le=10000000)
    risk_pct: float = Field(default=0.01, gt=0, lt=0.1)

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        v = v.strip().upper()
        if not v or len(v) > 10:
            raise ValueError("Ticker must be 1-10 characters")
        return v

    @field_validator("entry_price", "stop_price")
    @classmethod
    def validate_prices(cls, v: float) -> float:
        if not math.isfinite(v) or v <= 0 or v > 100000:
            raise ValueError("Price must be positive, finite, and under 100,000")
        return v

    @field_validator("risk_pct")
    @classmethod
    def validate_risk_pct(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Risk percentage must be finite")
        return v


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
    request: OrderPreviewRequest,
    service: ScreenerService = Depends(get_screener_service),
):
    """Preview order calculations (shares, position size, risk)."""
    # Additional relationship validation
    if request.entry_price <= request.stop_price:
        raise HTTPException(
            status_code=400,
            detail="Entry price must be greater than stop price (for long positions)"
        )
    
    return service.preview_order(
        ticker=request.ticker,
        entry_price=request.entry_price,
        stop_price=request.stop_price,
        account_size=request.account_size,
        risk_pct=request.risk_pct,
    )

