"""Compatibility shim for legacy imports.

Use `swing_screener.selection.ranking` as canonical import path.
"""

from swing_screener.selection.ranking import RankingConfig, compute_hot_score, top_candidates

__all__ = ["RankingConfig", "compute_hot_score", "top_candidates"]
