from __future__ import annotations

from dataclasses import dataclass, field
import pandas as pd

from swing_screener.data.currency import detect_currency
from swing_screener.indicators.trend import TrendConfig, compute_trend_features
from swing_screener.indicators.volatility import (
    VolatilityConfig,
    compute_volatility_features,
)
from swing_screener.indicators.momentum import MomentumConfig, compute_momentum_features


@dataclass(frozen=True)
class UniverseFilterConfig:
    min_price: float = 10.0
    max_price: float = 60.0
    max_atr_pct: float = 10.0
    require_trend_ok: bool = True
    require_rs_positive: bool = False
    currencies: list[str] = field(default_factory=lambda: ["USD", "EUR"])


@dataclass(frozen=True)
class UniverseConfig:
    trend: TrendConfig = TrendConfig()
    vol: VolatilityConfig = VolatilityConfig(atr_window=14)
    mom: MomentumConfig = MomentumConfig(benchmark="SPY")
    filt: UniverseFilterConfig = UniverseFilterConfig()


def build_feature_table(
    ohlcv: pd.DataFrame,
    cfg: UniverseConfig = UniverseConfig(),
) -> pd.DataFrame:
    """
    Join trend + volatility + momentum into a single per-ticker feature table.

    Returns index=ticker with columns including:
      last, sma*, trend_ok, dist_sma*_pct
      atr{window}, atr_pct
      mom_6m, mom_12m, rs_6m
    """
    trend_df = compute_trend_features(ohlcv, cfg.trend)
    vol_df = compute_volatility_features(ohlcv, cfg.vol)
    mom_df = compute_momentum_features(ohlcv, cfg.mom)

    feats = trend_df.join(vol_df, how="inner").join(mom_df, how="inner")

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
    cond_currency = detected_currencies.isin(allowed_currencies)

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

    eligible = cond_price & cond_atr & cond_trend & cond_rs & cond_currency
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
        reasons.append(",".join(r) if r else "ok")

    df["reason"] = reasons
    return df


def build_universe(
    ohlcv: pd.DataFrame,
    cfg: UniverseConfig = UniverseConfig(),
) -> pd.DataFrame:
    """
    Shortcut: build features + apply filters.
    """
    feats = build_feature_table(ohlcv, cfg)
    return apply_universe_filters(feats, cfg.filt)


def eligible_universe(
    ohlcv: pd.DataFrame,
    cfg: UniverseConfig = UniverseConfig(),
) -> pd.DataFrame:
    """
    Returns only eligible tickers (filtered).
    Sorted by momentum/RS as a convenience.
    """
    df = build_universe(ohlcv, cfg)
    df = df[df["is_eligible"]]
    if df.empty:
        return df
    return df.sort_values(["mom_6m", "rs_6m"], ascending=False)
