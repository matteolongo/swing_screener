from __future__ import annotations

from dataclasses import dataclass, field
import pandas as pd

from swing_screener.data.currency import detect_currency
from swing_screener.indicators.trend import TrendConfig, compute_trend_features, compute_weekly_trend_features
from swing_screener.indicators.volatility import (
    VolatilityConfig,
    compute_volatility_features,
)
from swing_screener.indicators.momentum import MomentumConfig, compute_momentum_features
from swing_screener.settings import get_settings_manager


def _universe_defaults() -> dict:
    sel = get_settings_manager().get_low_level_defaults_payload("selection")
    d = sel.get("universe", {})
    return d if isinstance(d, dict) else {}


@dataclass(frozen=True)
class UniverseFilterConfig:
    min_price: float = field(default_factory=lambda: float(_universe_defaults().get("min_price", 10.0)))
    max_price: float = field(default_factory=lambda: float(_universe_defaults().get("max_price", 60.0)))
    max_atr_pct: float = field(default_factory=lambda: float(_universe_defaults().get("max_atr_pct", 10.0)))
    require_trend_ok: bool = field(default_factory=lambda: bool(_universe_defaults().get("require_trend_ok", True)))
    require_rs_positive: bool = field(default_factory=lambda: bool(_universe_defaults().get("require_rs_positive", False)))
    require_weekly_uptrend: bool = field(default_factory=lambda: bool(_universe_defaults().get("require_weekly_uptrend", False)))
    currencies: list[str] = field(default_factory=lambda: list(_universe_defaults().get("currencies", ["USD", "EUR"])))
    min_avg_daily_volume_eur: float = field(
        default_factory=lambda: float(_universe_defaults().get("min_avg_daily_volume_eur", 0.0))
    )


@dataclass(frozen=True)
class UniverseConfig:
    trend: TrendConfig = TrendConfig()
    vol: VolatilityConfig = VolatilityConfig(atr_window=14)
    mom: MomentumConfig = MomentumConfig(benchmark="SPY")
    filt: UniverseFilterConfig = UniverseFilterConfig()


def build_feature_table(
    ohlcv: pd.DataFrame,
    cfg: UniverseConfig = UniverseConfig(),
    sector_benchmark_returns: dict[str, float] | None = None,
) -> pd.DataFrame:
    """
    Join trend + volatility + momentum into a single per-ticker feature table.

    Returns index=ticker with columns including:
      last, sma*, trend_ok, dist_sma*_pct
      atr{window}, atr_pct
      mom_6m, mom_12m, rs_6m
      weekly_trend
    """
    trend_df = compute_trend_features(ohlcv, cfg.trend)
    vol_df = compute_volatility_features(ohlcv, cfg.vol)
    mom_df = compute_momentum_features(
        ohlcv,
        cfg.mom,
        sector_benchmark_returns=sector_benchmark_returns,
    )

    feats = trend_df.join(vol_df, how="inner").join(mom_df, how="inner")

    weekly_df = compute_weekly_trend_features(ohlcv)
    feats = feats.join(weekly_df[["weekly_trend"]], how="left")
    feats["weekly_trend"] = feats["weekly_trend"].fillna("neutral")

    return feats.sort_index()


def apply_universe_filters(
    feats: pd.DataFrame,
    cfg: UniverseFilterConfig = UniverseFilterConfig(),
) -> pd.DataFrame:
    """
    Applies filters and adds:
      - is_eligible: bool
      - reason: comma-separated failing rules or "ok"
    """
    df = feats.copy()

    # base conditions
    cond_price = (df["last"] >= cfg.min_price) & (df["last"] <= cfg.max_price)
    cond_atr = df["atr_pct"] <= cfg.max_atr_pct
    allowed_currencies = {str(c).strip().upper() for c in cfg.currencies if str(c).strip()}
    if not allowed_currencies:
        allowed_currencies = {"USD", "EUR"}
    detected_currencies = pd.Series(
        [detect_currency(str(ticker)) for ticker in df.index],
        index=df.index,
    )
    df["currency"] = detected_currencies
    # UNKNOWN currency passes the filter (can't confirm a mismatch without instrument master entry).
    # Tickers with a known non-matching currency (e.g. GBP in a USD-only filter) are excluded.
    cond_currency = detected_currencies.isin(allowed_currencies) | (detected_currencies == "UNKNOWN")

    cond_trend = (
        (df["trend_ok"] == True)
        if cfg.require_trend_ok
        else pd.Series(True, index=df.index)
    )
    cond_rs = (
        (df["rs_6m"] > 0)
        if cfg.require_rs_positive
        else pd.Series(True, index=df.index)
    )

    # liquidity filter — skipped when column absent or threshold is 0
    if cfg.min_avg_daily_volume_eur > 0 and "avg_daily_volume_eur" in df.columns:
        cond_liquidity = df["avg_daily_volume_eur"] >= cfg.min_avg_daily_volume_eur
    else:
        cond_liquidity = pd.Series(True, index=df.index)

    # weekly trend filter — skipped when column absent or flag is False
    if cfg.require_weekly_uptrend:
        if "weekly_trend" in df.columns:
            cond_weekly = df["weekly_trend"] == "up"
        else:
            cond_weekly = pd.Series(False, index=df.index)
    else:
        cond_weekly = pd.Series(True, index=df.index)

    eligible = cond_price & cond_atr & cond_trend & cond_rs & cond_currency & cond_liquidity & cond_weekly
    df["is_eligible"] = eligible

    # reason column (useful for debugging)
    reasons = []
    for t in df.index:
        r = []
        if not bool(cond_price.loc[t]):
            r.append("price")
        if not bool(cond_atr.loc[t]):
            r.append("atr_pct")
        if not bool(cond_trend.loc[t]):
            r.append("trend")
        if not bool(cond_rs.loc[t]):
            r.append("rs")
        if not bool(cond_currency.loc[t]):
            r.append("currency")
        if not bool(cond_liquidity.loc[t]):
            r.append("liquidity")
        if not bool(cond_weekly.loc[t]):
            r.append("weekly_trend")
        reasons.append(",".join(r) if r else "ok")

    df["reason"] = reasons
    return df


def build_universe(
    ohlcv: pd.DataFrame,
    cfg: UniverseConfig = UniverseConfig(),
    sector_benchmark_returns: dict[str, float] | None = None,
) -> pd.DataFrame:
    """
    Shortcut: build features + apply filters.
    """
    feats = build_feature_table(
        ohlcv,
        cfg,
        sector_benchmark_returns=sector_benchmark_returns,
    )
    return apply_universe_filters(feats, cfg.filt)


def eligible_universe(
    ohlcv: pd.DataFrame,
    cfg: UniverseConfig = UniverseConfig(),
    sector_benchmark_returns: dict[str, float] | None = None,
) -> pd.DataFrame:
    """
    Returns only eligible tickers (filtered).
    Sorted by momentum/RS as a convenience.
    """
    df = build_universe(
        ohlcv,
        cfg,
        sector_benchmark_returns=sector_benchmark_returns,
    )
    df = df[df["is_eligible"]]
    if df.empty:
        return df
    return df.sort_values(["mom_6m", "rs_6m"], ascending=False)
