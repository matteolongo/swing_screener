from __future__ import annotations

from typing import Any, Optional

from swing_screener.selection.universe import UniverseConfig, UniverseFilterConfig
from swing_screener.indicators.trend import TrendConfig
from swing_screener.indicators.volatility import VolatilityConfig
from swing_screener.indicators.momentum import MomentumConfig
from swing_screener.selection.ranking import RankingConfig
from swing_screener.selection.entries import EntrySignalConfig
from swing_screener.risk.position_sizing import RiskConfig
from swing_screener.strategy.report_config import ReportConfig
from swing_screener.portfolio.state import ManageConfig
from swing_screener.utils import get_nested_dict


def build_universe_config(strategy: dict) -> UniverseConfig:
    trend = TrendConfig(**get_nested_dict(strategy, "universe", "trend"))
    vol = VolatilityConfig(**get_nested_dict(strategy, "universe", "vol"))
    mom = MomentumConfig(**get_nested_dict(strategy, "universe", "mom"))
    filt = UniverseFilterConfig(**get_nested_dict(strategy, "universe", "filt"))
    return UniverseConfig(trend=trend, vol=vol, mom=mom, filt=filt)


def build_ranking_config(strategy: dict) -> RankingConfig:
    return RankingConfig(**get_nested_dict(strategy, "ranking"))


def build_entry_config(strategy: dict) -> EntrySignalConfig:
    return EntrySignalConfig(**get_nested_dict(strategy, "signals"))


def build_risk_config(strategy: dict) -> RiskConfig:
    return RiskConfig(**get_nested_dict(strategy, "risk"))


def build_manage_config(strategy: dict) -> ManageConfig:
    raw = get_nested_dict(strategy, "manage")
    return ManageConfig(
        breakeven_at_R=raw.get("breakeven_at_r", 1.0),
        trail_after_R=raw.get("trail_after_r", 2.0),
        trail_sma=raw.get("trail_sma", 20),
        sma_buffer_pct=raw.get("sma_buffer_pct", 0.005),
        max_holding_days=raw.get("max_holding_days", 20),
        benchmark=raw.get("benchmark", "SPY"),
    )


def build_report_config(strategy: dict, *, top_override: Optional[int] = None) -> ReportConfig:
    universe = build_universe_config(strategy)
    ranking = build_ranking_config(strategy)
    signals = build_entry_config(strategy)
    risk = build_risk_config(strategy)
    strategy_module = strategy.get("module", "momentum") if isinstance(strategy, dict) else "momentum"

    if top_override is not None:
        ranking = RankingConfig(
            w_mom_6m=ranking.w_mom_6m,
            w_mom_12m=ranking.w_mom_12m,
            w_rs_6m=ranking.w_rs_6m,
            top_n=max(ranking.top_n, int(top_override)),
        )

    return ReportConfig(
        universe=universe,
        ranking=ranking,
        signals=signals,
        risk=risk,
        only_active_signals=False,
        strategy_module=strategy_module,
    )
