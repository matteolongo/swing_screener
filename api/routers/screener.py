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
from swing_screener.data.ticker_info import get_multiple_ticker_info
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
        from swing_screener.screeners.ranking import RankingConfig
        
        # Fetch market data with proper config
        cfg = MarketDataConfig(
            start="2022-01-01",
            end=asof_str,
            auto_adjust=True,
            progress=False,
        )
        ohlcv = fetch_ohlcv(tickers, cfg=cfg)
        
        # Create universe filters from request or use defaults
        universe_cfg = ScreenerUniverseConfig(
            filt=UniverseFilterConfig(
                min_price=request.min_price if request.min_price is not None else 5.0,
                max_price=request.max_price if request.max_price is not None else 500.0,
                max_atr_pct=15.0,  # More permissive
                require_trend_ok=True,
                require_rs_positive=False,
            )
        )
        
        # Run screener with custom config
        # NOTE: We'll get more than top_n initially, then filter by confidence
        report_cfg = ReportConfig(
            universe=universe_cfg,
            ranking=RankingConfig(top_n=100),  # Get larger pool for confidence ranking
        )
        
        results = build_daily_report(ohlcv, cfg=report_cfg, exclude_tickers=[])
        
        # Sort by confidence descending and take top N
        if not results.empty and "confidence" in results.columns:
            results = results.sort_values("confidence", ascending=False)
            # Take top N by confidence
            if request.top:
                results = results.head(request.top)
            # Re-rank based on confidence order
            results['rank'] = range(1, len(results) + 1)
        
        # Fetch company info for all tickers
        ticker_list = [str(idx) for idx in results.index]
        ticker_info = get_multiple_ticker_info(ticker_list) if ticker_list else {}
        
        # Convert to response format
        candidates = []
        for idx, row in results.iterrows():
            # Helper to safely convert to float, replacing NaN with 0
            def safe_float(val, default=0.0):
                import math
                if val is None or (isinstance(val, float) and math.isnan(val)):
                    return default
                return float(val)
            
            # Calculate SMAs from OHLCV if available, otherwise use distance metrics
            sma20 = safe_float(row.get("ma20_level"))
            sma50_dist = safe_float(row.get("dist_sma50_pct"))
            sma200_dist = safe_float(row.get("dist_sma200_pct"))
            last_price = safe_float(row.get("last"))
            
            # Approximate SMA values from distance percentages
            sma50 = last_price / (1 + sma50_dist / 100) if last_price and sma50_dist else last_price
            sma200 = last_price / (1 + sma200_dist / 100) if last_price and sma200_dist else last_price
            
            # Get company info
            ticker_str = str(idx)
            info = ticker_info.get(ticker_str, {})
            
            candidates.append(
                ScreenerCandidate(
                    ticker=ticker_str,
                    name=info.get('name'),
                    sector=info.get('sector'),
                    close=last_price,
                    sma_20=sma20,
                    sma_50=sma50,
                    sma_200=sma200,
                    atr=safe_float(row.get("atr14")),
                    momentum_6m=safe_float(row.get("mom_6m")),
                    momentum_12m=safe_float(row.get("mom_12m")),
                    rel_strength=safe_float(row.get("rs_6m")),
                    score=safe_float(row.get("score")),
                    confidence=safe_float(row.get("confidence")),
                    rank=int(row.get("rank", len(candidates) + 1)),
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
