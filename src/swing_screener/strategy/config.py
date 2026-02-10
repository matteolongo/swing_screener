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
from swing_screener.backtest.simulator import BacktestConfig
from swing_screener.social.config import SocialOverlayConfig


def _get_nested(payload: dict, *keys: str, default: Optional[dict] = None) -> dict:
    out: Any = payload
    for key in keys:
        if not isinstance(out, dict):
            return default or {}
        out = out.get(key, {})
    return out if isinstance(out, dict) else (default or {})


def build_universe_config(strategy: dict) -> UniverseConfig:
    trend = TrendConfig(**_get_nested(strategy, "universe", "trend"))
    vol = VolatilityConfig(**_get_nested(strategy, "universe", "vol"))
    mom = MomentumConfig(**_get_nested(strategy, "universe", "mom"))
    filt = UniverseFilterConfig(**_get_nested(strategy, "universe", "filt"))
    return UniverseConfig(trend=trend, vol=vol, mom=mom, filt=filt)


def build_ranking_config(strategy: dict) -> RankingConfig:
    return RankingConfig(**_get_nested(strategy, "ranking"))


def build_entry_config(strategy: dict) -> EntrySignalConfig:
    return EntrySignalConfig(**_get_nested(strategy, "signals"))


def build_risk_config(strategy: dict) -> RiskConfig:
    return RiskConfig(**_get_nested(strategy, "risk"))


def build_manage_config(strategy: dict) -> ManageConfig:
    raw = _get_nested(strategy, "manage")
    return ManageConfig(
        breakeven_at_R=raw.get("breakeven_at_r", 1.0),
        trail_after_R=raw.get("trail_after_r", 2.0),
        trail_sma=raw.get("trail_sma", 20),
        sma_buffer_pct=raw.get("sma_buffer_pct", 0.005),
        max_holding_days=raw.get("max_holding_days", 20),
        benchmark=raw.get("benchmark", "SPY"),
    )


def build_social_overlay_config(strategy: dict) -> SocialOverlayConfig:
    raw = _get_nested(strategy, "social_overlay")
    return SocialOverlayConfig(
        enabled=bool(raw.get("enabled", False)),
        lookback_hours=int(raw.get("lookback_hours", 24)),
        attention_z_threshold=float(raw.get("attention_z_threshold", 3.0)),
        min_sample_size=int(raw.get("min_sample_size", 20)),
        negative_sent_threshold=float(raw.get("negative_sent_threshold", -0.4)),
        sentiment_conf_threshold=float(raw.get("sentiment_conf_threshold", 0.7)),
        hype_percentile_threshold=float(raw.get("hype_percentile_threshold", 95.0)),
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


def build_backtest_config(
    strategy: dict, *, overrides: Optional[dict] = None
) -> BacktestConfig:
    overrides = overrides or {}
    signals = build_entry_config(strategy)
    universe = build_universe_config(strategy)
    risk = build_risk_config(strategy)

    raw = _get_nested(strategy, "backtest")

    entry_type = overrides.get("entry_type", raw.get("entry_type", "auto"))
    exit_mode = overrides.get("exit_mode", raw.get("exit_mode", "trailing_stop"))
    take_profit_r = overrides.get("take_profit_r", raw.get("take_profit_r", 2.0))
    max_holding_days = overrides.get("max_holding_days", raw.get("max_holding_days", 20))
    breakeven_at_r = overrides.get("breakeven_at_r", raw.get("breakeven_at_r", 1.0))
    trail_after_r = overrides.get("trail_after_r", raw.get("trail_after_r", 2.0))
    trail_sma = overrides.get("trail_sma", raw.get("trail_sma", 20))
    sma_buffer_pct = overrides.get("sma_buffer_pct", raw.get("sma_buffer_pct", 0.005))
    commission_pct = overrides.get("commission_pct", raw.get("commission_pct", 0.0))
    slippage_bps = overrides.get("slippage_bps", raw.get("slippage_bps", 5.0))
    fx_pct = overrides.get("fx_pct", raw.get("fx_pct", 0.0))
    min_history = overrides.get("min_history", raw.get("min_history", signals.min_history))

    return BacktestConfig(
        entry_type=entry_type,
        breakout_lookback=signals.breakout_lookback,
        pullback_ma=signals.pullback_ma,
        atr_window=universe.vol.atr_window,
        k_atr=risk.k_atr,
        exit_mode=exit_mode,
        take_profit_R=take_profit_r,
        max_holding_days=max_holding_days,
        breakeven_at_R=breakeven_at_r,
        trail_sma=trail_sma,
        trail_after_R=trail_after_r,
        sma_buffer_pct=sma_buffer_pct,
        min_history=min_history,
        commission_pct=commission_pct,
        slippage_bps=slippage_bps,
        fx_pct=fx_pct,
    )
