from __future__ import annotations

from dataclasses import dataclass
import pandas as pd


@dataclass(frozen=True)
class RankingConfig:
    w_mom_6m: float = 0.45
    w_mom_12m: float = 0.35
    w_rs_6m: float = 0.20
    top_n: int = 15


def _validate_weights(cfg: RankingConfig) -> None:
    s = cfg.w_mom_6m + cfg.w_mom_12m + cfg.w_rs_6m
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

    # Percentile ranks (0..1), higher is better
    r6 = out["mom_6m"].rank(pct=True)
    r12 = out["mom_12m"].rank(pct=True)
    rrs = out["rs_6m"].rank(pct=True)

    wsum = cfg.w_mom_6m + cfg.w_mom_12m + cfg.w_rs_6m
    w6 = cfg.w_mom_6m / wsum
    w12 = cfg.w_mom_12m / wsum
    wrs = cfg.w_rs_6m / wsum

    out["score"] = (w6 * r6) + (w12 * r12) + (wrs * rrs)

    out = out.sort_values("score", ascending=False)
    out["rank"] = range(1, len(out) + 1)

    return out


def top_candidates(
    df: pd.DataFrame, cfg: RankingConfig = RankingConfig()
) -> pd.DataFrame:
    """
    Returns top N rows by score.
    """
    scored = compute_hot_score(df, cfg)
    return scored.head(cfg.top_n)
