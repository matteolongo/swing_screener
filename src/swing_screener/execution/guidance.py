from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
import re


@dataclass(frozen=True)
class ExecutionConfig:
    breakout_stop_buffer_pct: float = 0.002
    pullback_atr_fraction: float = 0.25
    pullback_band_atr_low: float = 0.50
    pullback_band_atr_high: float = 0.00
    allow_second_chance_breakout: bool = True


def _pick_feature_column(df: pd.DataFrame, pattern: str, fallback: str) -> str | None:
    matches = [c for c in df.columns if re.match(pattern, str(c))]
    if len(matches) == 1:
        return str(matches[0])
    if fallback in df.columns:
        return fallback
    return None


def add_execution_guidance(
    report_df: pd.DataFrame, cfg: ExecutionConfig = ExecutionConfig()
) -> pd.DataFrame:
    if report_df is None:
        return pd.DataFrame()

    out = report_df.copy()

    out["suggested_order_type"] = "SKIP"
    out["suggested_order_price"] = np.nan
    out["suggested_validity"] = "DAY"
    out["execution_note"] = "No actionable signal."
    out["order_price_band_low"] = np.nan
    out["order_price_band_high"] = np.nan

    if out.empty or "signal" not in out.columns:
        return out

    ma_col = _pick_feature_column(out, r"^ma\d+_level$", "ma20_level")
    atr_col = _pick_feature_column(out, r"^atr\d+$", "atr14")

    last = out["last"] if "last" in out.columns else pd.Series(index=out.index, dtype=float)
    breakout_level = (
        out["breakout_level"]
        if "breakout_level" in out.columns
        else pd.Series(index=out.index, dtype=float)
    )
    ma_level = out[ma_col] if ma_col else pd.Series(index=out.index, dtype=float)
    atr_val = out[atr_col] if atr_col else pd.Series(index=out.index, dtype=float)

    mask_both = out["signal"] == "both"
    mask_breakout = out["signal"] == "breakout"
    mask_pullback = out["signal"] == "pullback"
    mask_both_as_pullback = mask_both & ma_level.notna()
    mask_breakout_like = mask_breakout | (mask_both & ~mask_both_as_pullback)

    mask_breakout_not_triggered = (
        mask_breakout_like
        & last.notna()
        & breakout_level.notna()
        & (last <= breakout_level)
    )
    out.loc[mask_breakout_not_triggered, "suggested_order_type"] = "BUY_STOP"
    out.loc[mask_breakout_not_triggered, "suggested_order_price"] = (
        breakout_level[mask_breakout_not_triggered]
        * (1.0 + cfg.breakout_stop_buffer_pct)
    )
    out.loc[
        mask_breakout_not_triggered, "execution_note"
    ] = "Breakout not triggered yet. Place BUY STOP slightly above breakout_level."

    mask_breakout_triggered = (
        mask_breakout_like
        & last.notna()
        & breakout_level.notna()
        & (last > breakout_level)
    )

    if cfg.allow_second_chance_breakout:
        mask_second_chance = mask_breakout_triggered & atr_val.notna()
        out.loc[mask_second_chance, "suggested_order_type"] = "BUY_LIMIT"
        out.loc[mask_second_chance, "suggested_order_price"] = (
            last[mask_second_chance] - cfg.pullback_atr_fraction * atr_val[mask_second_chance]
        )
        out.loc[mask_second_chance, "order_price_band_low"] = (
            last[mask_second_chance] - cfg.pullback_band_atr_low * atr_val[mask_second_chance]
        )
        out.loc[mask_second_chance, "order_price_band_high"] = (
            last[mask_second_chance] - cfg.pullback_band_atr_high * atr_val[mask_second_chance]
        )
        out.loc[
            mask_second_chance, "execution_note"
        ] = "Breakout already occurred. Do NOT use buy-stop. Limit entry only on pullback."
    else:
        out.loc[mask_breakout_triggered, "suggested_order_type"] = "SKIP"
        out.loc[mask_breakout_triggered, "suggested_order_price"] = np.nan
        out.loc[
            mask_breakout_triggered, "execution_note"
        ] = "Breakout already occurred. Trade skipped to avoid chasing."

    mask_pullback_ready = (mask_pullback | mask_both_as_pullback) & ma_level.notna()
    out.loc[mask_pullback_ready, "suggested_order_type"] = "BUY_LIMIT"
    out.loc[mask_pullback_ready, "suggested_order_price"] = ma_level[mask_pullback_ready]
    out.loc[
        mask_pullback_ready, "execution_note"
    ] = "Pullback setup. Place BUY LIMIT near moving-average reclaim level."
    out.loc[mask_pullback_ready, "order_price_band_low"] = ma_level[mask_pullback_ready]
    out.loc[mask_pullback_ready, "order_price_band_high"] = (
        ma_level[mask_pullback_ready] + 0.1 * atr_val[mask_pullback_ready].fillna(0.0)
    )

    return out
