"""Edge-case tests for the selection pipeline (previously only exercised indirectly)."""
import pandas as pd

from swing_screener.selection.entries import EntrySignalConfig
from swing_screener.selection.pipeline import (
    SelectionResult,
    build_selection_pipeline,
)
from swing_screener.selection.ranking import RankingConfig
from swing_screener.selection.universe import UniverseConfig


def _flat_ohlcv(tickers, periods=30):
    idx = pd.bdate_range("2024-01-02", periods=periods)
    data = {}
    for t in tickers:
        for field, base in [("Open", 100), ("High", 101), ("Low", 99), ("Close", 100), ("Volume", 1000)]:
            data[(field, t)] = pd.Series(float(base), index=idx)
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def _build(ohlcv, exclude_tickers=None):
    return build_selection_pipeline(
        ohlcv,
        universe_cfg=UniverseConfig(),
        ranking_cfg=RankingConfig(),
        entry_cfg=EntrySignalConfig(),
        exclude_tickers=exclude_tickers,
    )


def test_ineligible_universe_returns_all_empty_result():
    # flat, short-history data fails the eligibility filters
    result = _build(_flat_ohlcv(["AAA", "SPY"]))

    assert isinstance(result, SelectionResult)
    assert result.universe.empty
    assert result.ranked.empty
    assert result.board.empty


def test_exclude_tickers_on_empty_universe_does_not_crash():
    # exclusion list must be tolerated even when nothing is eligible
    result = _build(_flat_ohlcv(["AAA", "SPY"]), exclude_tickers=["AAA", None, "  "])

    assert result.universe.empty
    assert result.board.empty
