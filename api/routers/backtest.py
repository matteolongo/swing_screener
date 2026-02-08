"""Backtest router - Quick backtest for individual tickers."""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException
import datetime as dt
import pandas as pd
import uuid

from api.models import (
    QuickBacktestRequest,
    QuickBacktestResponse,
    BacktestSummary,
    BacktestTrade,
    FullBacktestRequest,
    FullBacktestResponse,
    FullBacktestSummary,
    FullBacktestSummaryByTicker,
    FullBacktestTrade,
    BacktestCurvePoint,
    BacktestSimulationMeta,
    BacktestSimulation,
)
from swing_screener.data.market_data import MarketDataConfig, fetch_ohlcv
from swing_screener.backtest.simulator import BacktestConfig, backtest_single_ticker_R, summarize_trades
from swing_screener.backtest.portfolio import equity_curve_R, equity_curve_by_ticker_R, drawdown_stats
from swing_screener.backtest.storage import (
    save_simulation,
    list_simulations,
    load_simulation,
    delete_simulation,
)

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


def _normalize_tickers(items: list[str]) -> list[str]:
    out: list[str] = []
    for item in items:
        if item is None:
            continue
        t = str(item).strip().upper()
        if t and t not in out:
            out.append(t)
    return out


def _safe_float_optional(val: object) -> float | None:
    if val is None:
        return None
    if isinstance(val, float) and pd.isna(val):
        return None
    try:
        return float(val)
    except Exception:
        return None


def _build_summary(trades: pd.DataFrame, max_drawdown_R: float | None) -> FullBacktestSummary:
    if trades is None or trades.empty:
        return FullBacktestSummary(trades=0)

    summary_df = summarize_trades(trades)
    row = summary_df.iloc[0] if summary_df is not None and not summary_df.empty else {}

    best_trade = float(trades["R"].max()) if "R" in trades.columns else None
    worst_trade = float(trades["R"].min()) if "R" in trades.columns else None

    return FullBacktestSummary(
        trades=int(row.get("trades", 0)),
        expectancy_R=_safe_float_optional(row.get("expectancy_R")),
        winrate=_safe_float_optional(row.get("winrate")),
        profit_factor_R=_safe_float_optional(row.get("profit_factor_R")),
        max_drawdown_R=_safe_float_optional(max_drawdown_R),
        avg_R=_safe_float_optional(row.get("avg_R")),
        best_trade_R=_safe_float_optional(best_trade),
        worst_trade_R=_safe_float_optional(worst_trade),
    )


def _build_summary_by_ticker(trades_all: pd.DataFrame) -> list[FullBacktestSummaryByTicker]:
    if trades_all is None or trades_all.empty or "ticker" not in trades_all.columns:
        return []

    out: list[FullBacktestSummaryByTicker] = []
    for ticker, df in trades_all.groupby("ticker"):
        summary_df = summarize_trades(df)
        row = summary_df.iloc[0] if summary_df is not None and not summary_df.empty else {}
        out.append(
            FullBacktestSummaryByTicker(
                ticker=str(ticker),
                trades=int(row.get("trades", 0)),
                expectancy_R=_safe_float_optional(row.get("expectancy_R")),
                winrate=_safe_float_optional(row.get("winrate")),
                profit_factor_R=_safe_float_optional(row.get("profit_factor_R")),
                max_drawdown_R=None,
                avg_R=_safe_float_optional(row.get("avg_R")),
                best_trade_R=_safe_float_optional(df["R"].max()) if "R" in df.columns else None,
                worst_trade_R=_safe_float_optional(df["R"].min()) if "R" in df.columns else None,
            )
        )
    return out


def _curve_points_total(curve: pd.DataFrame) -> list[BacktestCurvePoint]:
    if curve is None or curve.empty:
        return []
    out: list[BacktestCurvePoint] = []
    for _, row in curve.iterrows():
        date_str = pd.to_datetime(row["date"]).date().isoformat()
        out.append(
            BacktestCurvePoint(
                date=date_str,
                R=float(row["R"]),
                cum_R=float(row["cum_R"]),
                ticker=None,
            )
        )
    return out


def _curve_points_by_ticker(curve: pd.DataFrame) -> list[BacktestCurvePoint]:
    if curve is None or curve.empty:
        return []
    out: list[BacktestCurvePoint] = []
    for _, row in curve.iterrows():
        date_str = pd.to_datetime(row["date"]).date().isoformat()
        out.append(
            BacktestCurvePoint(
                date=date_str,
                R=float(row["R"]),
                cum_R=float(row["cum_R"]),
                ticker=str(row["ticker"]),
            )
        )
    return out


def _format_simulation_name(
    *,
    created_at: dt.datetime,
    tickers: list[str],
    entry_type: str,
    start: str,
    end: str,
) -> str:
    ts = created_at.strftime("%Y-%m-%d %H:%M")
    if len(tickers) <= 4:
        tickers_label = ", ".join(tickers)
    else:
        tickers_label = ", ".join(tickers[:3]) + f" +{len(tickers) - 3}"
    return f"{ts} • {tickers_label} • {entry_type} • {start}→{end}"


@router.post("/run", response_model=FullBacktestResponse)
async def run_full_backtest(request: FullBacktestRequest):
    """
    Run a full backtest on one or more tickers and persist the results to disk.
    """
    try:
        tickers = _normalize_tickers(request.tickers)
        if not tickers:
            raise HTTPException(status_code=400, detail="tickers cannot be empty")

        start_date = pd.Timestamp(request.start).date()
        end_date = pd.Timestamp(request.end).date()
        if start_date > end_date:
            raise HTTPException(status_code=400, detail="start must be <= end")

        mcfg = MarketDataConfig(start=str(start_date), end=str(end_date))
        ohlcv = fetch_ohlcv(
            tickers,
            mcfg,
            use_cache=True,
            force_refresh=False,
        )

        if ohlcv is None or ohlcv.empty:
            raise HTTPException(status_code=404, detail="No market data found for requested tickers")

        cfg = BacktestConfig(
            entry_type=request.entry_type,
            breakout_lookback=request.breakout_lookback,
            pullback_ma=request.pullback_ma,
            atr_window=request.atr_window,
            k_atr=request.k_atr,
            exit_mode="trailing_stop",
            max_holding_days=request.max_holding_days,
            breakeven_at_R=request.breakeven_at_r,
            trail_after_R=request.trail_after_r,
            trail_sma=request.trail_sma,
            sma_buffer_pct=request.sma_buffer_pct,
            min_history=request.min_history,
            commission_pct=request.commission_pct,
        )

        trades_list: list[pd.DataFrame] = []
        warnings: list[str] = []

        for t in tickers:
            if "Close" not in ohlcv.columns.get_level_values(0) or t not in ohlcv["Close"].columns:
                warnings.append(f"No data for {t}.")
                continue

            close_series = ohlcv["Close"][t].dropna()
            bars = int(len(close_series))
            if bars < cfg.min_history:
                warnings.append(f"{t}: Not enough bars for reliable backtest ({bars} < {cfg.min_history}).")

            if cfg.entry_type in ["breakout", "auto"] and bars < cfg.breakout_lookback + 1:
                warnings.append(f"{t}: Not enough bars for breakout lookback ({bars} < {cfg.breakout_lookback + 1}).")
            if cfg.entry_type in ["pullback", "auto"] and bars < cfg.pullback_ma + 1:
                warnings.append(f"{t}: Not enough bars for pullback MA ({bars} < {cfg.pullback_ma + 1}).")

            tr = backtest_single_ticker_R(ohlcv, t, cfg)
            if tr is None or tr.empty:
                continue
            trades_list.append(tr)

        trades_all = pd.concat(trades_list, ignore_index=True) if trades_list else pd.DataFrame()

        curve_total = equity_curve_R(trades_all)
        curve_by_ticker = equity_curve_by_ticker_R(trades_all)
        dd = drawdown_stats(curve_total)

        summary = _build_summary(trades_all, dd.get("max_drawdown_R"))
        summary_by_ticker = _build_summary_by_ticker(trades_all)

        if summary.trades == 0:
            warnings.append("No trades generated. Try a longer range or different entry type.")

        trades_detail: list[FullBacktestTrade] = []
        if trades_all is not None and not trades_all.empty:
            for _, trade in trades_all.iterrows():
                trades_detail.append(
                    FullBacktestTrade(
                        ticker=str(trade.get("ticker")),
                        entry_date=str(trade.get("entry_date")),
                        entry_price=float(trade.get("entry")),
                        exit_date=str(trade.get("exit_date")),
                        exit_price=float(trade.get("exit")),
                        R=float(trade.get("R")),
                        exit_reason=str(trade.get("exit_type")),
                        holding_days=int(trade.get("holding_days")) if trade.get("holding_days") is not None else None,
                        stop_price=float(trade.get("stop")) if trade.get("stop") is not None else None,
                    )
                )

        created_at = dt.datetime.now()
        simulation_name = _format_simulation_name(
            created_at=created_at,
            tickers=tickers,
            entry_type=request.entry_type,
            start=str(start_date),
            end=str(end_date),
        )

        sim_id = f"{created_at.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

        response_payload = FullBacktestResponse(
            tickers=tickers,
            start=str(start_date),
            end=str(end_date),
            entry_type=request.entry_type,
            summary=summary,
            summary_by_ticker=summary_by_ticker,
            trades=trades_detail,
            curve_total=_curve_points_total(curve_total),
            curve_by_ticker=_curve_points_by_ticker(curve_by_ticker),
            warnings=warnings,
            simulation_id=sim_id,
            simulation_name=simulation_name,
            created_at=created_at.isoformat(),
        )

        save_payload = {
            "id": sim_id,
            "created_at": created_at.isoformat(),
            "name": simulation_name,
            "params": request.model_dump(),
            "result": response_payload.model_dump(),
        }
        save_simulation(save_payload)

        return response_payload

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")


@router.get("/simulations", response_model=list[BacktestSimulationMeta])
async def list_backtest_simulations():
    try:
        return list_simulations()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list simulations: {e}")


@router.get("/simulations/{sim_id}", response_model=BacktestSimulation)
async def get_backtest_simulation(sim_id: str):
    try:
        payload = load_simulation(sim_id)
        return payload
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Simulation not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load simulation: {e}")


@router.delete("/simulations/{sim_id}")
async def delete_backtest_simulation(sim_id: str):
    try:
        delete_simulation(sim_id)
        return {"status": "deleted", "id": sim_id}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Simulation not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete simulation: {e}")
