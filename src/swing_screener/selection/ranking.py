from __future__ import annotations

from dataclasses import dataclass, field
import pandas as pd
from swing_screener.settings import get_settings_manager


def _ranking_defaults() -> dict:
    sel = get_settings_manager().get_low_level_defaults_payload("selection")
    d = sel.get("ranking", {})
    return d if isinstance(d, dict) else {}


@dataclass(frozen=True)
class RankingConfig:
    w_mom_6m: float = field(default_factory=lambda: float(_ranking_defaults().get("w_mom_6m", 0.45)))
    w_mom_12m: float = field(default_factory=lambda: float(_ranking_defaults().get("w_mom_12m", 0.35)))
    w_rs_6m: float = field(default_factory=lambda: float(_ranking_defaults().get("w_rs_6m", 0.20)))
    top_n: int = field(default_factory=lambda: int(_ranking_defaults().get("top_n", 15)))
    # Optional setup-quality weights — default 0 = disabled (backward-compatible)
    w_setup_quality: float = field(default_factory=lambda: float(_ranking_defaults().get("w_setup_quality", 0.0)))
    w_sma20_slope: float = field(default_factory=lambda: float(_ranking_defaults().get("w_sma20_slope", 0.0)))
    w_sector_rs: float = field(default_factory=lambda: float(_ranking_defaults().get("w_sector_rs", 0.0)))
    extension_penalty_cap: float = field(default_factory=lambda: float(_ranking_defaults().get("extension_penalty_cap", 0.10)))


def _validate_weights(cfg: RankingConfig) -> None:
    s = cfg.w_mom_6m + cfg.w_mom_12m + cfg.w_rs_6m + cfg.w_setup_quality + cfg.w_sma20_slope + cfg.w_sector_rs
    if s <= 0:
        raise ValueError("Sum of weights must be > 0.")


def compute_hot_score(
    df: pd.DataFrame, cfg: RankingConfig = RankingConfig()
) -> pd.DataFrame:
    """
    Adds:
      - score: weighted percentile ranks of mom_6m, mom_12m, rs_6m
      - rank: 1..N (1 = best)

    Input df must contain columns: mom_6m, mom_12m, rs_6m
    """
    _validate_weights(cfg)

    required = ["mom_6m", "mom_12m", "rs_6m"]
    for c in required:
        if c not in df.columns:
            raise ValueError(f"Missing required column: {c}")

    out = df.copy()

    # Percentile ranks (0..1), higher is better.
    # na_option='top' assigns NaN values the smallest rank (≈0 percentile) so
    # candidates with missing momentum data score near zero and sort to the bottom
    # rather than receiving NaN scores that corrupt the ordering.
    r6 = out["mom_6m"].rank(pct=True, na_option="top")
    r12 = out["mom_12m"].rank(pct=True, na_option="top")
    rrs = out["rs_6m"].rank(pct=True, na_option="top")

    # Accumulate weighted components; only include optional terms when weight > 0 AND
    # the column is present in the DataFrame.
    components: list[pd.Series] = [
        cfg.w_mom_6m * r6,
        cfg.w_mom_12m * r12,
        cfg.w_rs_6m * rrs,
    ]
    active_weight = cfg.w_mom_6m + cfg.w_mom_12m + cfg.w_rs_6m

    if cfg.w_setup_quality > 0 and "consolidation_tightness" in out.columns:
        sq = out["consolidation_tightness"].fillna(0.5)
        if "close_location_in_range" in out.columns:
            sq = (sq + out["close_location_in_range"].fillna(0.5)) / 2.0
        r_sq = sq.rank(pct=True, na_option="top")
        components.append(cfg.w_setup_quality * r_sq)
        active_weight += cfg.w_setup_quality

    if cfg.w_sma20_slope > 0 and "sma20_slope" in out.columns:
        r_slope = out["sma20_slope"].rank(pct=True, na_option="top")
        components.append(cfg.w_sma20_slope * r_slope)
        active_weight += cfg.w_sma20_slope

    if cfg.w_sector_rs > 0 and "sector_rs_6m" in out.columns:
        r_sector = out["sector_rs_6m"].rank(pct=True, na_option="top")
        components.append(cfg.w_sector_rs * r_sector)
        active_weight += cfg.w_sector_rs

    out["score"] = sum(components) / active_weight

    # Extension penalty: subtract raw extension value, capped at extension_penalty_cap.
    if cfg.extension_penalty_cap > 0 and "above_breakout_extension" in out.columns:
        penalty = out["above_breakout_extension"].fillna(0.0).clip(lower=0.0, upper=cfg.extension_penalty_cap)
        out["score"] = (out["score"] - penalty).clip(lower=0.0)

    out = out.sort_values("score", ascending=False)
    out["rank"] = range(1, len(out) + 1)

    return out


def normalize_technical_score(df: pd.DataFrame) -> pd.Series:
    """Returns the score column normalized to 0..1 range (min-max).

    Used as input to the combined priority stage. Returns 0.5 for all rows
    when the range is zero (all candidates share the same score).
    """
    s = df["score"]
    rng = s.max() - s.min()
    if rng == 0:
        return pd.Series(0.5, index=df.index)
    return (s - s.min()) / rng


def top_candidates(
    df: pd.DataFrame, cfg: RankingConfig = RankingConfig()
) -> pd.DataFrame:
    """
    Returns top N rows by score.
    """
    scored = compute_hot_score(df, cfg)
    return scored.head(cfg.top_n)
