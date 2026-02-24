"""Selection pipeline (universe, ranking, and entry signals)."""

from swing_screener.selection.universe import (
    UniverseConfig,
    UniverseFilterConfig,
    apply_universe_filters,
    build_feature_table,
    build_universe,
    eligible_universe,
)
from swing_screener.selection.ranking import (
    RankingConfig,
    compute_hot_score,
    top_candidates,
)
from swing_screener.selection.entries import (
    EntrySignalConfig,
    breakout_signal,
    pullback_reclaim_signal,
    build_signal_board,
)
from swing_screener.selection.pipeline import build_selection_pipeline

__all__ = [
    "UniverseConfig",
    "UniverseFilterConfig",
    "apply_universe_filters",
    "build_feature_table",
    "build_universe",
    "eligible_universe",
    "RankingConfig",
    "compute_hot_score",
    "top_candidates",
    "EntrySignalConfig",
    "breakout_signal",
    "pullback_reclaim_signal",
    "build_signal_board",
    "build_selection_pipeline",
]
