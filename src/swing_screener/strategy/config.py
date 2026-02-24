from __future__ import annotations

from typing import Any, Optional

from swing_screener.screeners.universe import UniverseConfig, UniverseFilterConfig
from swing_screener.indicators.trend import TrendConfig
from swing_screener.indicators.volatility import VolatilityConfig
from swing_screener.indicators.momentum import MomentumConfig
from swing_screener.screeners.ranking import RankingConfig
from swing_screener.signals.entries import EntrySignalConfig
from swing_screener.risk.position_sizing import RiskConfig
from swing_screener.reporting.config import ReportConfig
from swing_screener.portfolio.state import ManageConfig
from swing_screener.social.config import (
    DEFAULT_PROVIDERS,
    DEFAULT_SENTIMENT_ANALYZER,
    SocialOverlayConfig,
)
from swing_screener.utils import get_nested_dict

SUPPORTED_SOCIAL_PROVIDERS = {"reddit", "yahoo_finance"}
SUPPORTED_SENTIMENT_ANALYZERS = {"keyword", "vader"}


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


def build_social_overlay_config(strategy: dict) -> SocialOverlayConfig:
    raw = get_nested_dict(strategy, "social_overlay")
    providers_raw = raw.get("providers", DEFAULT_PROVIDERS)
    provider_candidates = (
        providers_raw
        if isinstance(providers_raw, (list, tuple, set))
        else [providers_raw]
    )
    providers_clean: list[str] = []
    for provider in provider_candidates:
        normalized = str(provider).strip().lower()
        if normalized and normalized in SUPPORTED_SOCIAL_PROVIDERS and normalized not in providers_clean:
            providers_clean.append(normalized)

    sentiment_analyzer = str(
        raw.get("sentiment_analyzer", DEFAULT_SENTIMENT_ANALYZER)
    ).strip().lower()
    if sentiment_analyzer not in SUPPORTED_SENTIMENT_ANALYZERS:
        sentiment_analyzer = DEFAULT_SENTIMENT_ANALYZER

    return SocialOverlayConfig(
        enabled=bool(raw.get("enabled", False)),
        lookback_hours=int(raw.get("lookback_hours", 24)),
        attention_z_threshold=float(raw.get("attention_z_threshold", 3.0)),
        min_sample_size=int(raw.get("min_sample_size", 20)),
        negative_sent_threshold=float(raw.get("negative_sent_threshold", -0.4)),
        sentiment_conf_threshold=float(raw.get("sentiment_conf_threshold", 0.7)),
        hype_percentile_threshold=float(raw.get("hype_percentile_threshold", 95.0)),
        providers=tuple(providers_clean or DEFAULT_PROVIDERS),
        sentiment_analyzer=sentiment_analyzer,
    )


def build_report_config(strategy: dict, *, top_override: Optional[int] = None) -> ReportConfig:
    universe = build_universe_config(strategy)
    ranking = build_ranking_config(strategy)
    signals = build_entry_config(strategy)
    risk = build_risk_config(strategy)
    social_overlay = build_social_overlay_config(strategy)
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
        social_overlay=social_overlay,
        only_active_signals=False,
        strategy_module=strategy_module,
    )
