from __future__ import annotations

from dataclasses import fields, replace

from swing_screener.indicators.momentum import MomentumConfig
from swing_screener.indicators.trend import TrendConfig
from swing_screener.indicators.volatility import VolatilityConfig
from swing_screener.portfolio.state import ManageConfig
from swing_screener.risk.position_sizing import RiskConfig
from swing_screener.selection.entries import EntrySignalConfig
from swing_screener.selection.ranking import RankingConfig
from swing_screener.selection.universe import UniverseConfig, UniverseFilterConfig
from swing_screener.strategy.report_config import ReportConfig
from swing_screener.utils import get_nested_dict

_RISK_CONFIG_FIELDS = {field.name for field in fields(RiskConfig)}
# Persisted/API strategies carry this for portfolio summary sizing mode; it is
# not an input to per-trade risk sizing.
_RISK_CONFIG_IGNORED_KEYS = {"account_size_mode"}


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
    raw = get_nested_dict(strategy, "risk")
    unsupported = sorted(set(raw) - _RISK_CONFIG_FIELDS - _RISK_CONFIG_IGNORED_KEYS)
    if unsupported:
        raise TypeError("Unsupported risk config field(s): " + ", ".join(unsupported))
    return RiskConfig(
        **{key: value for key, value in raw.items() if key in _RISK_CONFIG_FIELDS}
    )


def build_manage_config(strategy: dict) -> ManageConfig:
    raw = get_nested_dict(strategy, "manage")
    return ManageConfig(
        breakeven_at_R=raw.get("breakeven_at_r", 1.0),
        trail_after_R=raw.get("trail_after_r", 2.0),
        trail_sma=raw.get("trail_sma", 20),
        sma_buffer_pct=raw.get("sma_buffer_pct", 0.005),
        max_holding_days=raw.get("max_holding_days", 20),
        time_stop_days=raw.get("time_stop_days", 15),
        time_stop_min_r=raw.get("time_stop_min_r", 0.5),
        benchmark=raw.get("benchmark", "SPY"),
    )


def build_report_config(
    strategy: dict,
    *,
    top_override: int | None = None,
    universe_override: UniverseConfig | None = None,
    ranking_override: RankingConfig | None = None,
    signals_override: EntrySignalConfig | None = None,
    risk_override: RiskConfig | None = None,
) -> ReportConfig:
    universe = universe_override or build_universe_config(strategy)
    ranking = ranking_override or build_ranking_config(strategy)
    signals = signals_override or build_entry_config(strategy)
    risk = risk_override or build_risk_config(strategy)
    strategy_module = (
        strategy.get("module", "momentum") if isinstance(strategy, dict) else "momentum"
    )

    if top_override is not None:
        ranking = replace(ranking, top_n=max(ranking.top_n, int(top_override)))

    return ReportConfig(
        universe=universe,
        ranking=ranking,
        signals=signals,
        risk=risk,
        only_active_signals=False,
        strategy_module=strategy_module,
    )
