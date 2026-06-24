"""Backtest service: fetch point-in-time data and replay the live decision path.

Owns no trading logic. It fetches OHLCV via the same provider stack the screener
uses, builds a `BacktestConfig` from the active strategy (with optional per-request
overrides on top), and delegates to `swing_screener.backtest.run_event_study`.
"""

from __future__ import annotations

import logging
import math
from dataclasses import replace
from datetime import date
from typing import Optional

from swing_screener.backtest import BacktestConfig, run_event_study
from swing_screener.backtest.event_study import EventStudyResult
from swing_screener.backtest.metrics import BacktestMetrics
from swing_screener.data.providers import MarketDataProvider, get_default_provider
from swing_screener.errors import ServiceError, UpstreamError, ValidationError
from swing_screener.strategy.config import (
    build_entry_config,
    build_manage_config,
    build_risk_config,
)
from swing_screener.utils import get_nested_dict

from api.models.backtest import (
    BacktestConfigOverrides,
    BacktestMetricsModel,
    BacktestRunLaunchResponse,
    BacktestRunStatusResponse,
    EventStudyRequest,
    EventStudyResponse,
    SetupMetricsModel,
    TradeModel,
)

logger = logging.getLogger(__name__)

# Earliest history we scan by default. Matches the data layer's default start;
# documented as today's-snapshot scope in src/swing_screener/backtest/README.md.
DEFAULT_START = "2022-01-01"


class BacktestService:
    def __init__(
        self,
        provider: Optional[MarketDataProvider] = None,
        strategy_repo=None,
    ) -> None:
        self._provider = provider or get_default_provider()
        if strategy_repo is None:
            from api.dependencies import get_strategy_repo

            strategy_repo = get_strategy_repo()
        self._strategy_repo = strategy_repo

    def run_event_study(self, request: EventStudyRequest) -> EventStudyResponse:
        tickers = [
            str(t).strip().upper() for t in request.tickers if t and str(t).strip()
        ]
        tickers = [t for i, t in enumerate(tickers) if t not in tickers[:i]]
        if not tickers:
            raise ValidationError("At least one ticker is required.")

        start = (request.start or DEFAULT_START).strip()
        end = (request.end or date.today().isoformat()).strip()

        try:
            ohlcv = self._provider.fetch_ohlcv(tickers, start_date=start, end_date=end)
        except Exception as exc:
            logger.exception("Backtest data fetch failed")
            raise UpstreamError(f"Failed to fetch market data: {exc}") from exc

        if ohlcv is None or ohlcv.empty:
            raise UpstreamError(
                "No market data returned for the requested tickers and window."
            )

        strategy = self._strategy_repo.get_active_strategy()
        config = _build_config(strategy, request.config)
        try:
            result = run_event_study(ohlcv, tickers, config)
        except Exception as exc:
            logger.exception("Event study failed")
            raise ServiceError(f"Backtest failed: {exc}") from exc

        return _to_response(tickers, start, end, request.config, result)

    def start_run_async(self, request: EventStudyRequest) -> BacktestRunLaunchResponse:
        from api.services.backtest_run_manager import get_backtest_run_manager

        def _run() -> EventStudyResponse:
            return self.run_event_study(request)

        manager = get_backtest_run_manager()
        job_id = manager.start_job(run_fn=_run)
        job = manager.get_job(job_id)
        if job is None:
            raise ServiceError("Failed to start backtest run.")
        return BacktestRunLaunchResponse(
            job_id=job.job_id,
            status=job.status,  # type: ignore[arg-type]
            created_at=job.created_at,
            updated_at=job.updated_at,
        )

    def get_run_status(self, job_id: str) -> BacktestRunStatusResponse:
        from api.services.backtest_run_manager import get_backtest_run_manager
        from swing_screener.errors import NotFoundError

        job = get_backtest_run_manager().get_job(job_id)
        if job is None:
            raise NotFoundError(f"Backtest run job not found: {job_id}")
        return BacktestRunStatusResponse(
            job_id=job.job_id,
            status=job.status,  # type: ignore[arg-type]
            result=job.result,
            error=job.error,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )


def _build_config(
    strategy: dict, overrides: Optional[BacktestConfigOverrides]
) -> BacktestConfig:
    # Baseline from the active strategy so the backtest mirrors live behaviour
    # (entry signals, ATR-stop multiple, R:R target, stop-management rules).
    # `execution` (pattern stop) is a global flag, not per-strategy, so it keeps
    # the ExecutionConfig defaults until overridden per request.
    risk = build_risk_config(strategy)
    cfg = BacktestConfig(
        entry=build_entry_config(strategy),
        manage=build_manage_config(strategy),
        k_atr=risk.k_atr,
        rr_target=risk.rr_target,
        atr_window=int(
            get_nested_dict(strategy, "universe", "vol").get("atr_window", 14)
        ),
    )
    if overrides is None:
        return cfg

    entry_kw = {}
    if overrides.breakout_lookback is not None:
        entry_kw["breakout_lookback"] = overrides.breakout_lookback
    if overrides.pullback_ma is not None:
        entry_kw["pullback_ma"] = overrides.pullback_ma
    if overrides.min_history is not None:
        entry_kw["min_history"] = overrides.min_history
    if entry_kw:
        cfg.entry = replace(cfg.entry, **entry_kw)

    exec_kw = {}
    if overrides.pattern_stop_enabled is not None:
        exec_kw["pattern_stop_enabled"] = overrides.pattern_stop_enabled
    if overrides.pattern_stop_atr_buffer is not None:
        exec_kw["pattern_stop_atr_buffer"] = overrides.pattern_stop_atr_buffer
    if exec_kw:
        cfg.execution = replace(cfg.execution, **exec_kw)

    if overrides.breakeven_at_r is not None:
        cfg.manage.breakeven_at_R = overrides.breakeven_at_r
    if overrides.trail_after_r is not None:
        cfg.manage.trail_after_R = overrides.trail_after_r
    if overrides.trail_sma is not None:
        cfg.manage.trail_sma = overrides.trail_sma
    if overrides.max_holding_days is not None:
        cfg.manage.max_holding_days = overrides.max_holding_days
    if overrides.exit_signal_days is not None:
        cfg.manage.exit_signal_days = overrides.exit_signal_days

    if overrides.k_atr is not None:
        cfg.k_atr = overrides.k_atr
    if overrides.rr_target is not None:
        cfg.rr_target = overrides.rr_target

    return cfg


def _pf(value: float) -> Optional[float]:
    """Map an infinite profit factor (no losses) to None for JSON safety."""
    return None if value is None or math.isinf(value) else round(float(value), 4)


def _setup_metrics_model(m: BacktestMetrics) -> SetupMetricsModel:
    return SetupMetricsModel(
        n_trades=m.n_trades,
        win_rate=round(m.win_rate, 4),
        expectancy_r=round(m.expectancy_r, 4),
        total_r=round(m.total_r, 4),
        profit_factor=_pf(m.profit_factor),
        avg_win_r=round(m.avg_win_r, 4),
        avg_loss_r=round(m.avg_loss_r, 4),
        avg_bars_held=round(m.avg_bars_held, 4),
        max_drawdown_r=round(m.max_drawdown_r, 4),
        exit_reason_counts=dict(m.exit_reason_counts),
    )


def _metrics_model(m: BacktestMetrics) -> BacktestMetricsModel:
    base = _setup_metrics_model(m)
    return BacktestMetricsModel(
        **base.model_dump(),
        by_setup={k: _setup_metrics_model(v) for k, v in m.by_setup.items()},
    )


def _to_response(
    tickers: list[str],
    start: str,
    end: str,
    overrides: Optional[BacktestConfigOverrides],
    result: EventStudyResult,
) -> EventStudyResponse:
    return EventStudyResponse(
        tickers=tickers,
        start=start,
        end=end,
        config_used=overrides.model_dump(exclude_none=True) if overrides else {},
        trades=[TradeModel(**t.__dict__) for t in result.trades],
        metrics=_metrics_model(result.metrics),
    )
