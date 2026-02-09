from __future__ import annotations

from typing import Any

import pandas as pd

from swing_screener.indicators.volatility import compute_atr
from swing_screener.risk.position_sizing import RiskConfig


def _get_benchmark_series(ohlcv: pd.DataFrame, field: str, benchmark: str) -> pd.Series | None:
    if ohlcv is None or ohlcv.empty:
        return None
    if not isinstance(ohlcv.columns, pd.MultiIndex):
        return None
    if field not in ohlcv.columns.get_level_values(0):
        return None
    if benchmark not in ohlcv[field].columns:
        return None
    series = ohlcv[field][benchmark].dropna()
    return series if not series.empty else None


def compute_regime_risk_multiplier(
    ohlcv: pd.DataFrame,
    benchmark: str,
    cfg: RiskConfig,
) -> tuple[float, dict[str, Any]]:
    """
    Compute a risk multiplier based on benchmark trend + volatility.
    Returns (multiplier, details).
    """
    details: dict[str, Any] = {
        "enabled": cfg.regime_enabled,
        "benchmark": benchmark,
        "trend_below_sma": None,
        "atr_pct": None,
        "reasons": [],
    }

    if not cfg.regime_enabled:
        return 1.0, details

    bmk = str(benchmark).strip().upper()
    close = _get_benchmark_series(ohlcv, "Close", bmk)
    high = _get_benchmark_series(ohlcv, "High", bmk)
    low = _get_benchmark_series(ohlcv, "Low", bmk)

    if close is None or high is None or low is None:
        details["reasons"].append("benchmark data missing")
        return 1.0, details

    multiplier = 1.0

    # Trend check (SMA)
    if cfg.regime_trend_sma > 1 and len(close) >= cfg.regime_trend_sma:
        sma = close.rolling(window=cfg.regime_trend_sma, min_periods=cfg.regime_trend_sma).mean().iloc[-1]
        last = close.iloc[-1]
        trend_below = bool(last < sma)
        details["trend_below_sma"] = trend_below
        if trend_below:
            multiplier *= cfg.regime_trend_multiplier
            details["reasons"].append(f"benchmark below SMA{cfg.regime_trend_sma}")
    else:
        details["reasons"].append("insufficient trend history")

    # Volatility check (ATR%)
    if cfg.regime_vol_atr_window > 1 and len(close) >= cfg.regime_vol_atr_window:
        df = pd.concat([high, low, close], axis=1).dropna()
        if not df.empty:
            h = df.iloc[:, 0].to_frame()
            l = df.iloc[:, 1].to_frame()
            c = df.iloc[:, 2].to_frame()
            atr_df = compute_atr(h, l, c, window=cfg.regime_vol_atr_window)
            if not atr_df.empty:
                atr = float(atr_df.iloc[-1, 0])
                last_close = float(c.iloc[-1, 0])
                if last_close > 0:
                    atr_pct = (atr / last_close) * 100.0
                    details["atr_pct"] = round(atr_pct, 4)
                    if cfg.regime_vol_atr_pct_threshold > 0 and atr_pct > cfg.regime_vol_atr_pct_threshold:
                        multiplier *= cfg.regime_vol_multiplier
                        details["reasons"].append(
                            f"benchmark ATR% {atr_pct:.2f} > {cfg.regime_vol_atr_pct_threshold:.2f}"
                        )
    else:
        details["reasons"].append("insufficient volatility history")

    return multiplier, details
