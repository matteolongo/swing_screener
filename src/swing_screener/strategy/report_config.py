from __future__ import annotations

import math
from dataclasses import dataclass, field

from swing_screener.execution.guidance import ExecutionConfig
from swing_screener.risk.position_sizing import RiskConfig
from swing_screener.selection.entries import EntrySignalConfig
from swing_screener.selection.ranking import RankingConfig
from swing_screener.selection.universe import UniverseConfig
from swing_screener.settings import get_settings_manager


@dataclass(frozen=True)
class ConfidenceConfig:
    score_weight: float = 0.50
    signal_weight: float = 0.25
    trend_weight: float = 0.15
    volatility_weight: float = 0.10
    both_strength: float = 1.0
    breakout_strength: float = 0.8
    pullback_strength: float = 0.6
    none_strength: float = 0.0
    unknown_strength: float = 0.5

    def __post_init__(self) -> None:
        weights = (
            self.score_weight,
            self.signal_weight,
            self.trend_weight,
            self.volatility_weight,
        )
        strengths = (
            self.both_strength,
            self.breakout_strength,
            self.pullback_strength,
            self.none_strength,
            self.unknown_strength,
        )
        if any(not math.isfinite(value) or value < 0 for value in weights):
            raise ValueError("confidence weights must be finite and non-negative")
        if sum(weights) <= 0:
            raise ValueError("confidence weights must have a positive total")
        if any(not math.isfinite(value) or value < 0 for value in strengths):
            raise ValueError("signal strengths must be finite and non-negative")


def _default_confidence_config() -> ConfidenceConfig:
    reporting = get_settings_manager().get_low_level_defaults_payload("reporting")
    raw = reporting.get("confidence", {}) if isinstance(reporting, dict) else {}
    return ConfidenceConfig(**(raw if isinstance(raw, dict) else {}))


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
    confidence: ConfidenceConfig = field(default_factory=_default_confidence_config)
    only_active_signals: bool = False
    strategy_module: str = "momentum"
