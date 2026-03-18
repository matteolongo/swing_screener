from __future__ import annotations

from dataclasses import dataclass

from swing_screener.selection.universe import UniverseConfig
from swing_screener.selection.ranking import RankingConfig
from swing_screener.selection.entries import EntrySignalConfig
from swing_screener.risk.position_sizing import RiskConfig


@dataclass(frozen=True)
class ReportConfig:
    universe: UniverseConfig = UniverseConfig()
    ranking: RankingConfig = RankingConfig(top_n=12)
    signals: EntrySignalConfig = EntrySignalConfig(breakout_lookback=50, pullback_ma=20)
    risk: RiskConfig = RiskConfig(account_size=500.0, risk_pct=0.01, k_atr=2.0, max_position_pct=0.60)
    only_active_signals: bool = False
    strategy_module: str = "momentum"
