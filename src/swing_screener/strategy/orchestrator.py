from __future__ import annotations

from typing import Iterable

import pandas as pd

from swing_screener.strategy.report_config import ReportConfig
from swing_screener.strategy.registry import get_strategy_module


def build_strategy_report(
    ohlcv: pd.DataFrame,
    cfg: ReportConfig = ReportConfig(),
    exclude_tickers: Iterable[str] | None = None,
) -> pd.DataFrame:
    module = get_strategy_module(cfg.strategy_module)
    return module.build_report(ohlcv, cfg=cfg, exclude_tickers=exclude_tickers)
