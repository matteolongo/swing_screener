"""Screener router - Run screener and preview orders."""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException
import datetime as dt

from api.models import (
    ScreenerRequest,
    ScreenerResponse,
    ScreenerCandidate,
    OrderPreview,
)
from api.dependencies import get_today_str

from swing_screener.data.universe import (
    load_universe_from_package,
    list_package_universes,
    UniverseConfig,
)
from swing_screener.data.market_data import fetch_ohlcv
from swing_screener.reporting.report import build_daily_report

router = APIRouter()


@router.get("/universes")
async def list_universes():
    """List available universe files."""
    try:
        universes = list_package_universes()
        return {"universes": universes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list universes: {e}")


@router.post("/run", response_model=ScreenerResponse)
async def run_screener(request: ScreenerRequest):
    """Run the screener on a universe of stocks."""
    try:
        # Determine date
        if request.asof_date:
            asof_str = request.asof_date
        else:
            asof_str = dt.date.today().isoformat()
        
        # Determine tickers
        if request.tickers:
            tickers = [t.upper() for t in request.tickers]
            if "SPY" not in tickers:
                tickers.append("SPY")
        elif request.universe:
            ucfg = UniverseConfig(benchmark="SPY", ensure_benchmark=True, max_tickers=request.top or 500)
            tickers = load_universe_from_package(request.universe, ucfg)
        else:
            # Default to mega
            ucfg = UniverseConfig(benchmark="SPY", ensure_benchmark=True, max_tickers=request.top or 500)
            tickers = load_universe_from_package("mega", ucfg)
        
        # Import MarketDataConfig and ReportConfig
        from swing_screener.data.market_data import MarketDataConfig
        from swing_screener.reporting.report import ReportConfig
        from swing_screener.screeners.universe import UniverseConfig as ScreenerUniverseConfig, UniverseFilterConfig
        
        # Fetch market data with proper config
        cfg = MarketDataConfig(
            start="2022-01-01",
            end=asof_str,
            auto_adjust=True,
            progress=False,
        )
        ohlcv = fetch_ohlcv(tickers, cfg=cfg)
        
        # Create more permissive universe filters for broader screening
        universe_cfg = ScreenerUniverseConfig(
            filt=UniverseFilterConfig(
                min_price=5.0,  # Lower than default 10
                max_price=500.0,  # Higher than default 60
                max_atr_pct=15.0,  # More permissive
                require_trend_ok=True,
                require_rs_positive=False,
            )
        )
        
        # Run screener with custom config
        report_cfg = ReportConfig(
            universe=universe_cfg,
            ranking=None,  # Will use defaults
        )
        
        results = build_daily_report(ohlcv, cfg=report_cfg, exclude_tickers=[])
        
        # Limit results
        if request.top and not results.empty:
            results = results.head(request.top)
        
        # Convert to response format
        candidates = []
        for idx, row in results.iterrows():
            candidates.append(
                ScreenerCandidate(
                    ticker=str(idx),  # ticker is the index
                    close=float(row.get("last", 0)),  # Use 'last' not 'close'
                    sma_20=float(row.get("sma_20", 0)),
                    sma_50=float(row.get("sma_50", 0)),
                    sma_200=float(row.get("sma_200", 0)),
                    atr=float(row.get("atr14", 0)),  # Default atr14
                    momentum_6m=float(row.get("mom_6m", 0)),
                    momentum_12m=float(row.get("mom_12m", 0)),
                    rel_strength=float(row.get("rs_6m", 0)),
                    score=float(row.get("score", 0)),
                    rank=int(row.get("rank", idx + 1) if "rank" in row else len(candidates) + 1),
                )
            )
        
        return ScreenerResponse(
            candidates=candidates,
            asof_date=asof_str,
            total_screened=len(tickers),
        )
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Screener failed: {str(e)}")


@router.post("/preview-order", response_model=OrderPreview)
async def preview_order(
    ticker: str,
    entry_price: float,
    stop_price: float,
    account_size: float = 50000,
    risk_pct: float = 0.01,
):
    """Preview order calculations (shares, position size, risk)."""
    import math
    
    try:
        if stop_price >= entry_price:
            raise HTTPException(status_code=400, detail="Stop price must be below entry price")
        
        # Calculate shares using risk formula
        r = entry_price - stop_price
        risk_dollars = account_size * risk_pct
        shares = max(1, math.floor(risk_dollars / r))
        
        position_size = shares * entry_price
        actual_risk = shares * r
        actual_risk_pct = actual_risk / account_size
        
        return OrderPreview(
            ticker=ticker.upper(),
            entry_price=entry_price,
            stop_price=stop_price,
            atr=r,  # Simplified - using R as ATR proxy
            shares=shares,
            position_size_usd=position_size,
            risk_usd=actual_risk,
            risk_pct=actual_risk_pct,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {e}")
