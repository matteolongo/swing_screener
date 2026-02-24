from __future__ import annotations

from typing import Protocol, Iterable
import pandas as pd

from swing_screener.strategy.report_config import ReportConfig


class StrategyModule(Protocol):
    name: str

    def build_report(
        self,
        ohlcv: pd.DataFrame,
        cfg: ReportConfig,
        exclude_tickers: Iterable[str] | None = None,
    ) -> pd.DataFrame:
        ...
