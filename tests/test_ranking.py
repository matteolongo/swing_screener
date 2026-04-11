import math

import pandas as pd

from swing_screener.selection.ranking import (
    compute_hot_score,
    top_candidates,
    RankingConfig,
)


def test_ranking_adds_score_and_rank():
    df = pd.DataFrame(
        {
            "mom_6m": [0.20, 0.10, 0.30],
            "mom_12m": [0.10, 0.05, 0.20],
            "rs_6m": [0.02, -0.01, 0.05],
        },
        index=["A", "B", "C"],
    )

    out = compute_hot_score(df, RankingConfig(top_n=2))

    assert "score" in out.columns
    assert "rank" in out.columns
    assert out["rank"].iloc[0] == 1
    assert out.index[0] == "C"  # best in all 3 -> should top


def test_top_candidates_returns_top_n():
    df = pd.DataFrame(
        {
            "mom_6m": [0.20, 0.10, 0.30, 0.25],
            "mom_12m": [0.10, 0.05, 0.20, 0.18],
            "rs_6m": [0.02, -0.01, 0.05, 0.03],
        },
        index=["A", "B", "C", "D"],
    )

    top = top_candidates(df, RankingConfig(top_n=2))
    assert len(top) == 2
    assert "score" in top.columns
    assert top.index[0] in ["C", "D"]  # one of the best two


def test_nan_momentum_candidates_sort_to_bottom():
    """Candidates with NaN momentum values must rank last, not scatter mid-table.
    Regression test for: rank(pct=True) without na_option propagates NaN scores."""
    df = pd.DataFrame(
        {
            "mom_6m": [0.30, float("nan"), 0.10],
            "mom_12m": [0.20, float("nan"), 0.05],
            "rs_6m": [0.05, float("nan"), -0.01],
        },
        index=["strong", "missing", "weak"],
    )

    out = compute_hot_score(df, RankingConfig())

    # "missing" must be the last row and carry the highest rank number
    assert out.index[-1] == "missing", f"expected 'missing' last, got order {list(out.index)}"
    assert out.loc["missing", "rank"] == 3
    # "strong" must rank first
    assert out.index[0] == "strong"
    # the score for "missing" must not be NaN
    assert not math.isnan(out.loc["missing", "score"])


def test_partial_nan_momentum_preserves_valid_ordering():
    """When only some columns are NaN for a candidate, it still sorts below
    candidates with complete data."""
    df = pd.DataFrame(
        {
            "mom_6m": [0.25, float("nan"), 0.05],
            "mom_12m": [0.15, 0.10, 0.03],   # "partial" has a value here
            "rs_6m": [0.04, float("nan"), -0.02],
        },
        index=["good", "partial", "poor"],
    )

    out = compute_hot_score(df, RankingConfig())

    assert out.index[0] == "good"
    # "partial" must not outrank "good" despite having one valid momentum value
    assert out.loc["good", "rank"] < out.loc["partial", "rank"]


def test_invalid_weights_raises():
    df = pd.DataFrame(
        {"mom_6m": [0.1], "mom_12m": [0.1], "rs_6m": [0.1]},
        index=["A"],
    )

    try:
        compute_hot_score(df, RankingConfig(w_mom_6m=0.0, w_mom_12m=0.0, w_rs_6m=0.0))
        assert False, "Expected ValueError"
    except ValueError:
        assert True
