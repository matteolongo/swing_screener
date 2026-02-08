"""Backtest router - Quick backtest for individual tickers."""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException
import datetime as dt
import pandas as pd

from api.models import (
    QuickBacktestRequest,
    QuickBacktestResponse,
    BacktestSummary,
    BacktestTrade,
)
from swing_screener.data.market_data import MarketDataConfig, fetch_ohlcv
from swing_screener.backtest.simulator import BacktestConfig, backtest_single_ticker_R, summarize_trades
from swing_screener.backtest.portfolio import equity_curve_R, drawdown_stats

router = APIRouter()


@router.post("/quick", response_model=QuickBacktestResponse)
async def quick_backtest(request: QuickBacktestRequest):
    """
    Run a quick backtest on a single ticker.
    
    Auto-detects entry type if not specified.
    Uses default backtest parameters unless overridden.
    Returns summary statistics and trade details.
    """
    try:
        # Calculate date range
        end_date = dt.date.today()
        start_date = (pd.Timestamp(end_date) - pd.DateOffset(months=request.months_back)).date()
        
        start_str = str(start_date)
        end_str = str(end_date)
        
        # Fetch market data
        mcfg = MarketDataConfig(start=start_str, end=end_str)
        ohlcv = fetch_ohlcv(
            [request.ticker],
            mcfg,
            use_cache=True,
            force_refresh=False,
        )
        
        # Check if we have data
        if ohlcv is None or ohlcv.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No market data found for {request.ticker}"
            )
        
        # Build backtest config (use defaults from BacktestConfig if not provided)
        cfg = BacktestConfig(
            entry_type=request.entry_type or "pullback",
            k_atr=request.k_atr if request.k_atr is not None else 2.0,
            max_holding_days=request.max_holding_days if request.max_holding_days is not None else 20,
        )
        
        # Run backtest
        trades = backtest_single_ticker_R(ohlcv, request.ticker, cfg)
        
        # Generate summary
        summary_df = summarize_trades(trades)
        curve = equity_curve_R(trades)
        dd = drawdown_stats(curve)
        
        # Build summary stats
        if summary_df is None or summary_df.empty:
            summary_dict = {
                "trades": 0,
                "expectancy_R": 0.0,
                "winrate": 0.0,
                "profit_factor_R": 0.0,
                "max_drawdown_R": 0.0,
                "avg_R": 0.0,
                "best_trade_R": None,
                "worst_trade_R": None,
            }
        else:
            # Helper to safely convert to float (handles None)
            def safe_float(val, default=0.0):
                return float(val) if val is not None and pd.notna(val) else default
            
            summary_dict = {
                "trades": int(summary_df.iloc[0].get("trades", 0)),
                "expectancy_R": safe_float(summary_df.iloc[0].get("expectancy_R")),
                "winrate": safe_float(summary_df.iloc[0].get("winrate")),
                "profit_factor_R": safe_float(summary_df.iloc[0].get("profit_factor_R")),
                "max_drawdown_R": safe_float(dd.get("max_drawdown_R")),
                "avg_R": safe_float(summary_df.iloc[0].get("avg_R")),
                "best_trade_R": float(trades["R"].max()) if trades is not None and not trades.empty else None,
                "worst_trade_R": float(trades["R"].min()) if trades is not None and not trades.empty else None,
            }
        
        summary = BacktestSummary(**summary_dict)
        
        # Build trades detail
        trades_detail = []
        if trades is not None and not trades.empty:
            for _, trade in trades.iterrows():
                trades_detail.append(
                    BacktestTrade(
                        entry_date=str(trade["entry_date"]),
                        entry_price=float(trade["entry"]),
                        exit_date=str(trade["exit_date"]),
                        exit_price=float(trade["exit"]),
                        R=float(trade["R"]),
                        exit_reason=str(trade["exit_type"]),
                    )
                )
        
        # Count bars
        close_series = ohlcv["Close"][request.ticker].dropna()
        bars = int(len(close_series))
        
        # Generate warnings
        warnings = []
        if bars < cfg.min_history:
            warnings.append(f"Not enough bars for reliable backtest ({bars} < {cfg.min_history}).")
        if cfg.entry_type == "breakout" and bars < cfg.breakout_lookback + 1:
            warnings.append(f"Not enough bars for breakout lookback ({bars} < {cfg.breakout_lookback + 1}).")
        if cfg.entry_type == "pullback" and bars < cfg.pullback_ma + 1:
            warnings.append(f"Not enough bars for pullback MA ({bars} < {cfg.pullback_ma + 1}).")
        if summary_dict["trades"] == 0:
            warnings.append("No trades generated. Try a longer lookback period or different entry type.")
        
        return QuickBacktestResponse(
            ticker=request.ticker,
            start=start_str,
            end=end_str,
            bars=bars,
            trades=summary_dict["trades"],
            summary=summary,
            trades_detail=trades_detail,
            warnings=warnings,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")
