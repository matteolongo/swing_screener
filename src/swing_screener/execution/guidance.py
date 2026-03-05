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


def _coerce_numeric_series(value: pd.Series | pd.DataFrame | None, index: pd.Index) -> pd.Series:
    if value is None:
        return pd.Series(index=index, dtype=float)

    if isinstance(value, pd.DataFrame):
        if value.shape[1] == 0:
            return pd.Series(index=index, dtype=float)
        # When duplicate labels exist, pick the column with the most numeric values.
        best: pd.Series | None = None
        best_non_null = -1
        for i in range(value.shape[1]):
            coerced = pd.to_numeric(value.iloc[:, i], errors="coerce")
            non_null = int(coerced.notna().sum())
            if non_null > best_non_null:
                best = coerced
                best_non_null = non_null
        if best is None:
            return pd.Series(index=index, dtype=float)
        return best.reindex(index).astype(float)

    return pd.to_numeric(value, errors="coerce").reindex(index).astype(float)


def _pick_numeric_column(df: pd.DataFrame, candidates: list[str]) -> pd.Series:
    merged: pd.Series | None = None
    for col in candidates:
        if col not in df.columns:
            continue
        coerced = _coerce_numeric_series(df[col], df.index)
        if merged is None:
            merged = coerced
        else:
            # Prefer the first candidate, fill only missing values from fallbacks.
            merged = merged.combine_first(coerced)
    if merged is None:
        return pd.Series(index=df.index, dtype=float)
    return merged.astype(float)


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

    last = _pick_numeric_column(out, ["last"])
    breakout_level = _pick_numeric_column(out, ["breakout_level", "breakout_level_sig"])
    ma_level = _coerce_numeric_series(out[ma_col], out.index) if ma_col else pd.Series(index=out.index, dtype=float)
    atr_val = _coerce_numeric_series(out[atr_col], out.index) if atr_col else pd.Series(index=out.index, dtype=float)

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
    if bool(mask_breakout_not_triggered.any()):
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
        if bool(mask_second_chance.any()):
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
    if bool(mask_pullback_ready.any()):
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
