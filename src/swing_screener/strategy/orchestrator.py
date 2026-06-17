from __future__ import annotations

from typing import Iterable

import pandas as pd

from swing_screener.strategy.report_config import ReportConfig
from swing_screener.strategy.registry import get_strategy_module


def build_strategy_report(
    ohlcv: pd.DataFrame,
    cfg: ReportConfig = ReportConfig(),
    exclude_tickers: Iterable[str] | None = None,
    sector_benchmark_returns: dict[str, float] | None = None,
    eval_cache=None,
    asof_date: str | None = None,
    force_refresh: bool = False,
) -> pd.DataFrame:
    module = get_strategy_module(cfg.strategy_module)
    return module.build_report(
        ohlcv,
        cfg=cfg,
        exclude_tickers=exclude_tickers,
        sector_benchmark_returns=sector_benchmark_returns,
        eval_cache=eval_cache,
        asof_date=asof_date,
        force_refresh=force_refresh,
    )
