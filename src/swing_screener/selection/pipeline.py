from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import pandas as pd

from swing_screener.selection.universe import UniverseConfig, eligible_universe
from swing_screener.selection.ranking import RankingConfig, top_candidates
from swing_screener.selection.entries import EntrySignalConfig, build_signal_board


@dataclass(frozen=True)
class SelectionResult:
    universe: pd.DataFrame
    ranked: pd.DataFrame
    board: pd.DataFrame


def build_selection_pipeline(
    ohlcv: pd.DataFrame,
    *,
    universe_cfg: UniverseConfig,
    ranking_cfg: RankingConfig,
    entry_cfg: EntrySignalConfig,
    exclude_tickers: Iterable[str] | None = None,
) -> SelectionResult:
    univ = eligible_universe(ohlcv, universe_cfg)
    if univ is None or univ.empty:
        empty = pd.DataFrame()
        return SelectionResult(universe=empty, ranked=empty, board=empty)

    if exclude_tickers:
        excluded = {
            str(item).strip().upper()
            for item in exclude_tickers
            if item is not None and str(item).strip()
        }
        if excluded:
            univ = univ.drop(index=list(excluded), errors="ignore")

    ranked = top_candidates(univ, ranking_cfg) if not univ.empty else pd.DataFrame()
    if ranked.empty:
        return SelectionResult(universe=univ, ranked=ranked, board=pd.DataFrame())

    board = build_signal_board(ohlcv, ranked.index.tolist(), entry_cfg)
    return SelectionResult(universe=univ, ranked=ranked, board=board)
