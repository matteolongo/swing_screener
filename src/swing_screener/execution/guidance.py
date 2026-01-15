from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class ExecutionConfig:
    breakout_stop_buffer_pct: float = 0.002
    pullback_atr_fraction: float = 0.25
    pullback_band_atr_low: float = 0.50
    pullback_band_atr_high: float = 0.00
    allow_second_chance_breakout: bool = True


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

    last = out["last"] if "last" in out.columns else pd.Series(index=out.index, dtype=float)
    breakout_level = (
        out["breakout_level"]
        if "breakout_level" in out.columns
        else pd.Series(index=out.index, dtype=float)
    )
    ma20_level = (
        out["ma20_level"]
        if "ma20_level" in out.columns
        else pd.Series(index=out.index, dtype=float)
    )
    atr14 = out["atr14"] if "atr14" in out.columns else pd.Series(index=out.index, dtype=float)

    mask_breakout = out["signal"] == "breakout"
    mask_pullback = out["signal"] == "pullback"

    mask_breakout_not_triggered = (
        mask_breakout
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
        mask_breakout
        & last.notna()
        & breakout_level.notna()
        & (last > breakout_level)
    )

    if cfg.allow_second_chance_breakout:
        mask_second_chance = mask_breakout_triggered & atr14.notna()
        out.loc[mask_second_chance, "suggested_order_type"] = "BUY_LIMIT"
        out.loc[mask_second_chance, "suggested_order_price"] = (
            last[mask_second_chance] - cfg.pullback_atr_fraction * atr14[mask_second_chance]
        )
        out.loc[mask_second_chance, "order_price_band_low"] = (
            last[mask_second_chance] - cfg.pullback_band_atr_low * atr14[mask_second_chance]
        )
        out.loc[mask_second_chance, "order_price_band_high"] = (
            last[mask_second_chance] - cfg.pullback_band_atr_high * atr14[mask_second_chance]
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

    mask_pullback_ready = mask_pullback & ma20_level.notna()
    out.loc[mask_pullback_ready, "suggested_order_type"] = "BUY_LIMIT"
    out.loc[mask_pullback_ready, "suggested_order_price"] = ma20_level[mask_pullback_ready]
    out.loc[
        mask_pullback_ready, "execution_note"
    ] = "Pullback setup. Place BUY LIMIT near MA20 level."
    out.loc[mask_pullback_ready, "order_price_band_low"] = ma20_level[mask_pullback_ready]
    out.loc[mask_pullback_ready, "order_price_band_high"] = (
        ma20_level[mask_pullback_ready] + 0.1 * atr14[mask_pullback_ready]
    )

    return out
