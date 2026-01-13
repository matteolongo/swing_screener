import pandas as pd

from swing_screener.screeners.ranking import (
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
