from __future__ import annotations

from dataclasses import dataclass, field

from swing_screener.execution.guidance import ExecutionConfig
from swing_screener.risk.position_sizing import RiskConfig
from swing_screener.selection.entries import EntrySignalConfig
from swing_screener.selection.ranking import RankingConfig
from swing_screener.selection.universe import UniverseConfig


@dataclass(frozen=True)
class ReportConfig:
    universe: UniverseConfig = field(default_factory=UniverseConfig)
    ranking: RankingConfig = field(default_factory=lambda: RankingConfig(top_n=12))
    signals: EntrySignalConfig = field(
        default_factory=lambda: EntrySignalConfig(breakout_lookback=50, pullback_ma=20)
    )
    risk: RiskConfig = field(
        default_factory=lambda: RiskConfig(
            account_size=500.0,
            risk_pct=0.01,
            k_atr=2.0,
            max_position_pct=0.60,
        )
    )
    execution: ExecutionConfig = field(default_factory=ExecutionConfig)
    only_active_signals: bool = False
    strategy_module: str = "momentum"
