from __future__ import annotations

from dataclasses import dataclass, field

from swing_screener.selection.entries import EntrySignalConfig
from swing_screener.portfolio.state import ManageConfig
from swing_screener.execution.guidance import ExecutionConfig
from swing_screener.indicators.candles import CandleConfig
from swing_screener.risk.position_sizing import RiskConfig


@dataclass
class BacktestConfig:
    """Bundle of the live config surfaces the event study replays.

    Each sub-config defaults to the same values the live screener/portfolio
    manager use (loaded from ``config/defaults.yaml``). Override any field to
    test a variant (e.g. ``execution.pattern_stop_enabled`` on/off, or a
    different ``manage.breakeven_at_R``) without touching production config.
    """

    entry: EntrySignalConfig = field(default_factory=EntrySignalConfig)
    manage: ManageConfig = field(default_factory=ManageConfig)
    execution: ExecutionConfig = field(default_factory=ExecutionConfig)
    candles: CandleConfig = field(default_factory=CandleConfig)
    k_atr: float = field(default_factory=lambda: RiskConfig().k_atr)
    rr_target: float = field(default_factory=lambda: RiskConfig().rr_target)
    atr_window: int = 14
