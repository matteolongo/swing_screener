from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest

from swing_screener.indicators.setup_quality import compute_setup_quality
from swing_screener.selection.ranking import RankingConfig, compute_hot_score


# ── helpers ──────────────────────────────────────────────────────────────────

def _make_ohlcv(
    close: list[float],
    high: list[float] | None = None,
    low: list[float] | None = None,
    volume: list[float] | None = None,
    ticker: str = "TEST",
) -> pd.DataFrame:
    """Build a minimal OHLCV MultiIndex DataFrame with one ticker."""
    n = len(close)
    idx = pd.date_range("2024-01-01", periods=n, freq="B")

    if high is None:
        high = [c * 1.01 for c in close]
    if low is None:
        low = [c * 0.99 for c in close]

    arrays: dict[str, list[float]] = {"Close": close, "High": high, "Low": low}
    if volume is not None:
        arrays["Volume"] = volume

    frames = {}
    for field, vals in arrays.items():
        frames[field] = pd.DataFrame({ticker: vals}, index=idx)

    combined = pd.concat(frames, axis=1)
    combined.columns = pd.MultiIndex.from_tuples([(f, ticker) for f, _ in combined.columns])
    return combined


def _make_ranking_df(
    *,
    n: int = 5,
    extension: list[float] | None = None,
    setup_quality: list[float] | None = None,
) -> pd.DataFrame:
    """Build a minimal ranking DataFrame with required momentum columns."""
    rng = np.random.default_rng(42)
    df = pd.DataFrame(
        {
            "mom_6m": rng.uniform(0.0, 0.3, n),
            "mom_12m": rng.uniform(0.0, 0.4, n),
            "rs_6m": rng.uniform(-0.1, 0.2, n),
        },
        index=[f"T{i}" for i in range(n)],
    )
    if extension is not None:
        df["above_breakout_extension"] = extension
    if setup_quality is not None:
        df["consolidation_tightness"] = setup_quality
    return df


# ── test 1: tight base scores higher ─────────────────────────────────────────

def test_tight_consolidation_scores_higher() -> None:
    """A stock whose ATR has contracted (tight base) should have higher
    consolidation_tightness than one whose ATR has not contracted."""
    n = 100
    base_close = list(np.linspace(100.0, 110.0, n))

    # Tight: recent bars have half the range of older bars
    high_tight = base_close[:]
    low_tight = [c - 0.5 for c in base_close]  # current ATR ≈ 0.5
    # Inject larger historical range to make atr63 bigger
    for i in range(n - 77, n - 14):
        high_tight[i] = base_close[i] + 2.0
        low_tight[i] = base_close[i] - 2.0

    # Loose: recent bars have the same range as historical bars
    high_loose = [c + 2.0 for c in base_close]
    low_loose = [c - 2.0 for c in base_close]

    ohlcv_tight = _make_ohlcv(base_close, high=high_tight, low=low_tight, ticker="TIGHT")
    ohlcv_loose = _make_ohlcv(base_close, high=high_loose, low=low_loose, ticker="LOOSE")

    result_tight = compute_setup_quality(ohlcv_tight, ["TIGHT"])
    result_loose = compute_setup_quality(ohlcv_loose, ["LOOSE"])

    ct_tight = result_tight.loc["TIGHT", "consolidation_tightness"]
    ct_loose = result_loose.loc["LOOSE", "consolidation_tightness"]

    assert not math.isnan(ct_tight), "consolidation_tightness should not be NaN for tight base"
    assert ct_tight > ct_loose, f"Tight base ({ct_tight:.3f}) should score higher than loose ({ct_loose:.3f})"


# ── test 2: missing volume produces NaN, no crash ────────────────────────────

def test_missing_volume_produces_nan_no_crash() -> None:
    """When volume is absent the function must not raise and must not produce
    a breakout_volume_confirmation column (or produce all-NaN)."""
    close = list(np.linspace(100.0, 110.0, 100))
    ohlcv = _make_ohlcv(close, ticker="NOVOL")  # no volume column

    result = compute_setup_quality(ohlcv, ["NOVOL"])

    assert "NOVOL" in result.index
    assert "breakout_volume_confirmation" not in result.columns or result["breakout_volume_confirmation"].isna().all()


# ── test 3: new ranking columns optional and backward-compatible ─────────────

def test_ranking_without_new_columns_unchanged() -> None:
    """When all new optional weights are 0 (default), compute_hot_score must
    produce the same ordering as before the new columns were added."""
    df = _make_ranking_df(n=6)

    cfg_default = RankingConfig(
        w_mom_6m=0.45, w_mom_12m=0.35, w_rs_6m=0.20,
        w_setup_quality=0.0, w_sma20_slope=0.0, w_sector_rs=0.0,
        extension_penalty_cap=0.0,
        top_n=6,
    )
    result_default = compute_hot_score(df, cfg_default)

    # Add setup-quality columns that would matter if weights were non-zero
    df_with_extras = df.copy()
    df_with_extras["consolidation_tightness"] = 0.9
    df_with_extras["above_breakout_extension"] = 0.20

    result_with_extras = compute_hot_score(df_with_extras, cfg_default)

    assert list(result_default.index) == list(result_with_extras.index), (
        "Adding new columns should not change ordering when optional weights are 0"
    )


# ── test 4: extension penalty reduces score for extended candidate ────────────

def test_extension_penalty_reduces_score() -> None:
    """A candidate with a large extension above the 50-bar high should score
    lower than an identical candidate with no extension."""
    df_extended = _make_ranking_df(n=3, extension=[0.15, 0.0, 0.0])
    df_clean = _make_ranking_df(n=3, extension=[0.0, 0.0, 0.0])

    # Use identical momentum so only the penalty drives the score difference.
    df_extended.iloc[0] = df_clean.iloc[0]  # same momentum for row 0
    df_extended.loc[df_extended.index[0], "above_breakout_extension"] = 0.15

    cfg = RankingConfig(
        w_mom_6m=0.45, w_mom_12m=0.35, w_rs_6m=0.20,
        extension_penalty_cap=0.10,
        top_n=3,
    )
    scored_extended = compute_hot_score(df_extended, cfg)
    scored_clean = compute_hot_score(df_clean, cfg)

    # The extended candidate (T0) should score lower than its clean counterpart.
    t0_ext = scored_extended.loc["T0", "score"]
    t0_clean = scored_clean.loc["T0", "score"]

    assert t0_clean > t0_ext, (
        f"Clean candidate score ({t0_clean:.4f}) should exceed extended ({t0_ext:.4f})"
    )
