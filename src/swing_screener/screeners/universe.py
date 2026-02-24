"""Compatibility shim for legacy imports.

Use `swing_screener.selection.universe` as canonical import path.
"""

from swing_screener.selection.universe import (
    UniverseConfig,
    UniverseFilterConfig,
    apply_universe_filters,
    build_feature_table,
    build_universe,
    eligible_universe,
)

__all__ = [
    "UniverseConfig",
    "UniverseFilterConfig",
    "apply_universe_filters",
    "build_feature_table",
    "build_universe",
    "eligible_universe",
]
