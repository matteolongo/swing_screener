"""Backtest service."""
from __future__ import annotations

from dataclasses import replace
from typing import Optional
import datetime as dt
import uuid

import pandas as pd
from fastapi import HTTPException

from api.models.backtest import (
    QuickBacktestRequest,
    QuickBacktestResponse,
    BacktestSummary,
    BacktestTrade,
    BacktestCostSummary,
    BacktestEducation,
    FullBacktestRequest,
    FullBacktestResponse,
    FullBacktestSummary,
    FullBacktestSummaryByTicker,
    FullBacktestTrade,
    BacktestCurvePoint,
    BacktestSimulationMeta,
    BacktestSimulation,
)
from api.repositories.strategy_repo import StrategyRepository
from swing_screener.data.providers import MarketDataProvider, get_default_provider
from swing_screener.backtest.simulator import BacktestConfig, backtest_single_ticker_R, summarize_trades
from swing_screener.backtest.portfolio import (
    equity_curve_R,
    equity_curve_by_ticker_R,
    drawdown_stats,
    rr_distribution,
)
from swing_screener.backtest.storage import (
    save_simulation,
    list_simulations,
    load_simulation,
    delete_simulation,
)
from swing_screener.strategy.config import build_backtest_config


class BacktestService:
    def __init__(
        self,
        strategy_repo: StrategyRepository,
        provider: Optional[MarketDataProvider] = None
    ) -> None:
        self._strategy_repo = strategy_repo
        self._provider = provider or get_default_provider()

    def _resolve_strategy(self, strategy_id: Optional[str]) -> dict:
        if strategy_id:
            strategy = self._strategy_repo.get_strategy(strategy_id)
            if strategy is None:
                raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")
            return strategy
        return self._strategy_repo.get_active_strategy()

    def quick_backtest(self, request: QuickBacktestRequest) -> QuickBacktestResponse:
        try:
            end_date = dt.date.today()
            start_date = (pd.Timestamp(end_date) - pd.DateOffset(months=request.months_back)).date()

            start_str = str(start_date)
            end_str = str(end_date)

            ohlcv = self._provider.fetch_ohlcv(
                [request.ticker],
                start_date=start_str,
                end_date=end_str,
            )

            if ohlcv is None or ohlcv.empty:
                raise HTTPException(status_code=404, detail=f"No market data found for {request.ticker}")

            fields_set = request.model_fields_set
            if request.strategy_id:
                strategy = self._resolve_strategy(request.strategy_id)
                cfg = build_backtest_config(strategy)
                if "entry_type" in fields_set and request.entry_type is not None:
                    cfg = replace(cfg, entry_type=request.entry_type)
                if "k_atr" in fields_set and request.k_atr is not None:
                    cfg = replace(cfg, k_atr=request.k_atr)
                if "max_holding_days" in fields_set and request.max_holding_days is not None:
                    cfg = replace(cfg, max_holding_days=request.max_holding_days)
            else:
                cfg = BacktestConfig(
                    entry_type=request.entry_type or "pullback",
                    k_atr=request.k_atr if request.k_atr is not None else 2.0,
                    max_holding_days=request.max_holding_days if request.max_holding_days is not None else 20,
                )

            trades = backtest_single_ticker_R(ohlcv, request.ticker, cfg)

            summary_df = summarize_trades(trades)
            curve = equity_curve_R(trades)
            dd = drawdown_stats(curve)

            if summary_df is None or summary_df.empty:
                summary_dict = {
                    "trades": 0,
                    "expectancy_R": 0.0,
                    "winrate": 0.0,
                    "profit_factor_R": 0.0,
                    "max_drawdown_R": 0.0,
                    "avg_R": 0.0,
                    "avg_win_R": None,
                    "avg_loss_R": None,
                    "trade_frequency_per_year": None,
                    "rr_distribution": {},
                    "best_trade_R": None,
                    "worst_trade_R": None,
                    "avg_cost_R": None,
                    "total_cost_R": None,
                }
            else:
                def safe_float(val, default=0.0):
                    return float(val) if val is not None and pd.notna(val) else default

                trades_count = int(summary_df.iloc[0].get("trades", 0))
                summary_dict = {
                    "trades": trades_count,
                    "expectancy_R": safe_float(summary_df.iloc[0].get("expectancy_R")),
                    "winrate": safe_float(summary_df.iloc[0].get("winrate")),
                    "profit_factor_R": safe_float(summary_df.iloc[0].get("profit_factor_R")),
                    "max_drawdown_R": safe_float(dd.get("max_drawdown_R")),
                    "avg_R": safe_float(summary_df.iloc[0].get("avg_R")),
                    "avg_win_R": self._safe_float_optional(summary_df.iloc[0].get("avg_win_R")),
                    "avg_loss_R": self._safe_float_optional(summary_df.iloc[0].get("avg_loss_R")),
                    "trade_frequency_per_year": self._trade_frequency_per_year(
                        trades_count, start_str, end_str
                    ),
                    "rr_distribution": rr_distribution(trades),
                    "best_trade_R": float(trades["R"].max()) if trades is not None and not trades.empty else None,
                    "worst_trade_R": float(trades["R"].min()) if trades is not None and not trades.empty else None,
                    "avg_cost_R": safe_float(trades["R_cost"].mean()) if trades is not None and "R_cost" in trades.columns else None,
                    "total_cost_R": safe_float(trades["R_cost"].sum()) if trades is not None and "R_cost" in trades.columns else None,
                }

            summary = BacktestSummary(**summary_dict)
            cost_summary = self._build_cost_summary(trades, cfg)
            education = self._build_education(summary, cost_summary)

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

            close_series = ohlcv["Close"][request.ticker].dropna()
            bars = int(len(close_series))

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
                costs=cost_summary,
                education=education,
            )

        except HTTPException:
            raise
        except ValueError as exc:
            logger.error("Backtest configuration error: %s", exc)
            raise HTTPException(status_code=400, detail=f"Invalid backtest configuration: {str(exc)}")
        except (KeyError, IndexError) as exc:
            logger.error("Backtest data error: %s", exc)
            raise HTTPException(status_code=500, detail="Backtest failed due to data error")
        except Exception as exc:
            logger.exception("Unexpected backtest error")
            raise HTTPException(status_code=500, detail="Backtest failed unexpectedly")

    def _normalize_tickers(self, items: list[str]) -> list[str]:
        out: list[str] = []
        for item in items:
            if item is None:
                continue
            t = str(item).strip().upper()
            if t and t not in out:
                out.append(t)
        return out

    def _safe_float_optional(self, val: object) -> float | None:
        if val is None:
            return None
        if isinstance(val, float) and pd.isna(val):
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    def _trade_frequency_per_year(self, trades: int, start: str | None, end: str | None) -> float | None:
        if trades <= 0 or not start or not end:
            return None
        try:
            start_dt = pd.to_datetime(start)
            end_dt = pd.to_datetime(end)
            days = (end_dt - start_dt).days
            if days <= 0:
                return None
            years = days / 365.25
            return float(trades) / years if years > 0 else None
        except (ValueError, TypeError):
            return None

    def _build_summary(
        self,
        trades: pd.DataFrame,
        max_drawdown_R: float | None,
        start: str | None = None,
        end: str | None = None,
    ) -> FullBacktestSummary:
        if trades is None or trades.empty:
            return FullBacktestSummary(trades=0)

        summary_df = summarize_trades(trades)
        row = summary_df.iloc[0] if summary_df is not None and not summary_df.empty else {}

        best_trade = float(trades["R"].max()) if "R" in trades.columns else None
        worst_trade = float(trades["R"].min()) if "R" in trades.columns else None

        avg_cost_R = self._safe_float_optional(trades["R_cost"].mean()) if "R_cost" in trades.columns else None
        total_cost_R = self._safe_float_optional(trades["R_cost"].sum()) if "R_cost" in trades.columns else None

        trades_count = int(row.get("trades", 0))
        return FullBacktestSummary(
            trades=trades_count,
            expectancy_R=self._safe_float_optional(row.get("expectancy_R")),
            winrate=self._safe_float_optional(row.get("winrate")),
            profit_factor_R=self._safe_float_optional(row.get("profit_factor_R")),
            max_drawdown_R=self._safe_float_optional(max_drawdown_R),
            avg_R=self._safe_float_optional(row.get("avg_R")),
            avg_win_R=self._safe_float_optional(row.get("avg_win_R")),
            avg_loss_R=self._safe_float_optional(row.get("avg_loss_R")),
            trade_frequency_per_year=self._trade_frequency_per_year(trades_count, start, end),
            rr_distribution=rr_distribution(trades),
            best_trade_R=self._safe_float_optional(best_trade),
            worst_trade_R=self._safe_float_optional(worst_trade),
            avg_cost_R=avg_cost_R,
            total_cost_R=total_cost_R,
        )

    def _build_summary_by_ticker(
        self, trades_all: pd.DataFrame, start: str | None, end: str | None
    ) -> list[FullBacktestSummaryByTicker]:
        if trades_all is None or trades_all.empty or "ticker" not in trades_all.columns:
            return []

        out: list[FullBacktestSummaryByTicker] = []
        for ticker, df in trades_all.groupby("ticker"):
            summary_df = summarize_trades(df)
            row = summary_df.iloc[0] if summary_df is not None and not summary_df.empty else {}
            trades_count = int(row.get("trades", 0))
            out.append(
                FullBacktestSummaryByTicker(
                    ticker=str(ticker),
                    trades=trades_count,
                    expectancy_R=self._safe_float_optional(row.get("expectancy_R")),
                    winrate=self._safe_float_optional(row.get("winrate")),
                    profit_factor_R=self._safe_float_optional(row.get("profit_factor_R")),
                    max_drawdown_R=None,
                    avg_R=self._safe_float_optional(row.get("avg_R")),
                    avg_win_R=self._safe_float_optional(row.get("avg_win_R")),
                    avg_loss_R=self._safe_float_optional(row.get("avg_loss_R")),
                    trade_frequency_per_year=self._trade_frequency_per_year(trades_count, start, end),
                    rr_distribution=rr_distribution(df),
                    best_trade_R=self._safe_float_optional(df["R"].max()) if "R" in df.columns else None,
                    worst_trade_R=self._safe_float_optional(df["R"].min()) if "R" in df.columns else None,
                    avg_cost_R=self._safe_float_optional(df["R_cost"].mean()) if "R_cost" in df.columns else None,
                    total_cost_R=self._safe_float_optional(df["R_cost"].sum()) if "R_cost" in df.columns else None,
                )
            )
        return out

    def _build_cost_summary(self, trades: pd.DataFrame, cfg: BacktestConfig) -> BacktestCostSummary:
        avg_cost_R = (
            self._safe_float_optional(trades["R_cost"].mean())
            if trades is not None and "R_cost" in trades.columns
            else None
        )
        total_cost_R = (
            self._safe_float_optional(trades["R_cost"].sum())
            if trades is not None and "R_cost" in trades.columns
            else None
        )
        gross_total = (
            self._safe_float_optional(trades["R_gross"].sum())
            if trades is not None and "R_gross" in trades.columns
            else None
        )
        net_total = (
            self._safe_float_optional(trades["R"].sum())
            if trades is not None and "R" in trades.columns
            else None
        )
        fee_impact_pct = None
        if gross_total is not None and gross_total != 0 and total_cost_R is not None:
            fee_impact_pct = abs(total_cost_R) / abs(gross_total)
        return BacktestCostSummary(
            commission_pct=cfg.commission_pct,
            slippage_bps=cfg.slippage_bps,
            fx_pct=cfg.fx_pct,
            gross_R_total=gross_total,
            net_R_total=net_total,
            fee_impact_pct=fee_impact_pct,
            avg_cost_R=avg_cost_R,
            total_cost_R=total_cost_R,
        )

    def _build_education(self, summary: FullBacktestSummary | BacktestSummary, costs: BacktestCostSummary) -> BacktestEducation:
        drivers: list[str] = []
        caveats: list[str] = [
            "Assumes entries at next bar open and ignores intraday liquidity constraints.",
            "Results include estimated costs (commission, slippage, FX).",
        ]

        if summary.trades == 0:
            overview = "No trades were generated in this window."
        else:
            overview = "Results are net of basic execution costs and designed for learning, not prediction."

        if summary.expectancy_R is not None:
            drivers.append(f"Expectancy: {summary.expectancy_R:.2f}R")
        if summary.winrate is not None:
            drivers.append(f"Win rate: {summary.winrate:.0%}")
        if summary.avg_win_R is not None and summary.avg_loss_R is not None:
            drivers.append(
                f"Avg win/loss: {summary.avg_win_R:.2f}R / {summary.avg_loss_R:.2f}R"
            )
        if summary.trade_frequency_per_year is not None:
            drivers.append(
                f"Trade frequency: {summary.trade_frequency_per_year:.1f} trades/year"
            )
        if costs.total_cost_R is not None and costs.total_cost_R > 0:
            drivers.append("Costs reduced results; review position sizing and trade frequency.")
        if costs.fee_impact_pct is not None:
            drivers.append(f"Fee impact: {costs.fee_impact_pct:.0%} of gross R.")

        return BacktestEducation(overview=overview, drivers=drivers, caveats=caveats)

    def _curve_points_total(self, curve: pd.DataFrame) -> list[BacktestCurvePoint]:
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

    def _curve_points_by_ticker(self, curve: pd.DataFrame) -> list[BacktestCurvePoint]:
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
        self,
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

    def run_full_backtest(self, request: FullBacktestRequest) -> FullBacktestResponse:
        try:
            tickers = self._normalize_tickers(request.tickers)
            if not tickers:
                raise HTTPException(status_code=400, detail="tickers cannot be empty")

            start_date = pd.Timestamp(request.start).date()
            end_date = pd.Timestamp(request.end).date()
            if start_date > end_date:
                raise HTTPException(status_code=400, detail="start must be <= end")

            ohlcv = self._provider.fetch_ohlcv(tickers, start_date=str(start_date), end_date=str(end_date))

            if ohlcv is None or ohlcv.empty:
                raise HTTPException(status_code=404, detail="No market data found for requested tickers")

            fields_set = request.model_fields_set
            strategy = self._resolve_strategy(request.strategy_id)
            strategy_id_used = strategy.get("id")
            overrides: dict[str, object] = {}
            for field in [
                "entry_type",
                "max_holding_days",
                "breakeven_at_r",
                "trail_after_r",
                "trail_sma",
                "sma_buffer_pct",
                "commission_pct",
                "slippage_bps",
                "fx_pct",
                "min_history",
            ]:
                if field in fields_set:
                    overrides[field] = getattr(request, field)

            cfg = build_backtest_config(strategy, overrides=overrides)

            if "breakout_lookback" in fields_set:
                cfg = replace(cfg, breakout_lookback=request.breakout_lookback)
            if "pullback_ma" in fields_set:
                cfg = replace(cfg, pullback_ma=request.pullback_ma)
            if "atr_window" in fields_set:
                cfg = replace(cfg, atr_window=request.atr_window)
            if "k_atr" in fields_set:
                cfg = replace(cfg, k_atr=request.k_atr)

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
                    warnings.append(
                        f"{t}: Not enough bars for breakout lookback ({bars} < {cfg.breakout_lookback + 1})."
                    )
                if cfg.entry_type in ["pullback", "auto"] and bars < cfg.pullback_ma + 1:
                    warnings.append(
                        f"{t}: Not enough bars for pullback MA ({bars} < {cfg.pullback_ma + 1})."
                    )

                tr = backtest_single_ticker_R(ohlcv, t, cfg)
                if tr is None or tr.empty:
                    continue
                trades_list.append(tr)

            trades_all = pd.concat(trades_list, ignore_index=True) if trades_list else pd.DataFrame()

            curve_total = equity_curve_R(trades_all)
            curve_by_ticker = equity_curve_by_ticker_R(trades_all)
            dd = drawdown_stats(curve_total)

            summary = self._build_summary(
                trades_all, dd.get("max_drawdown_R"), start=str(start_date), end=str(end_date)
            )
            summary_by_ticker = self._build_summary_by_ticker(
                trades_all, start=str(start_date), end=str(end_date)
            )
            cost_summary = self._build_cost_summary(trades_all, cfg)
            education = self._build_education(summary, cost_summary)

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
                            holding_days=int(trade.get("holding_days"))
                            if trade.get("holding_days") is not None
                            else None,
                            stop_price=float(trade.get("stop")) if trade.get("stop") is not None else None,
                        )
                    )

            created_at = dt.datetime.now()
            simulation_name = self._format_simulation_name(
                created_at=created_at,
                tickers=tickers,
                entry_type=cfg.entry_type,
                start=str(start_date),
                end=str(end_date),
            )

            sim_id = f"{created_at.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

            response_payload = FullBacktestResponse(
                tickers=tickers,
                start=str(start_date),
                end=str(end_date),
                entry_type=cfg.entry_type,
                summary=summary,
                summary_by_ticker=summary_by_ticker,
                trades=trades_detail,
                curve_total=self._curve_points_total(curve_total),
                curve_by_ticker=self._curve_points_by_ticker(curve_by_ticker),
                warnings=warnings,
                simulation_id=sim_id,
                simulation_name=simulation_name,
                created_at=created_at.isoformat(),
                costs=cost_summary,
                education=education,
            )

            params_payload = request.model_dump()
            if params_payload.get("strategy_id") is None and strategy_id_used:
                params_payload["strategy_id"] = strategy_id_used

            save_payload = {
                "id": sim_id,
                "created_at": created_at.isoformat(),
                "name": simulation_name,
                "params": params_payload,
                "result": response_payload.model_dump(),
            }
            save_simulation(save_payload)

            return response_payload

        except HTTPException:
            raise
        except ValueError as exc:
            logger.error("Backtest configuration error: %s", exc)
            raise HTTPException(status_code=400, detail=f"Invalid backtest request: {str(exc)}")
        except (KeyError, IndexError) as exc:
            logger.error("Backtest data error: %s", exc)
            raise HTTPException(status_code=500, detail="Backtest failed due to data error")
        except Exception as exc:
            logger.exception("Unexpected backtest error")
            raise HTTPException(status_code=500, detail="Backtest failed unexpectedly")

    def list_simulations(self) -> list[BacktestSimulationMeta]:
        try:
            return list_simulations()
        except (FileNotFoundError, PermissionError) as exc:
            logger.error("Failed to access simulation directory: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to list simulations (file access error)")
        except Exception as exc:
            logger.exception("Unexpected error listing simulations")
            raise HTTPException(status_code=500, detail="Failed to list simulations")

    def get_simulation(self, sim_id: str) -> BacktestSimulation:
        try:
            return load_simulation(sim_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Simulation not found")
        except (ValueError, KeyError) as exc:
            logger.error("Invalid simulation data: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to load simulation (data error)")
        except Exception as exc:
            logger.exception("Unexpected error loading simulation")
            raise HTTPException(status_code=500, detail="Failed to load simulation")

    def delete_simulation(self, sim_id: str) -> dict:
        try:
            delete_simulation(sim_id)
            return {"status": "deleted", "id": sim_id}
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Simulation not found")
        except PermissionError as exc:
            logger.error("Permission denied deleting simulation: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to delete simulation (permission denied)")
        except Exception as exc:
            logger.exception("Unexpected error deleting simulation")
            raise HTTPException(status_code=500, detail="Failed to delete simulation")
