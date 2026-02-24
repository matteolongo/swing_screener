"""Compatibility shim for legacy imports.

Use `swing_screener.selection.entries` as canonical import path.
"""

from swing_screener.selection.entries import (
    EntrySignalConfig,
    breakout_signal,
    pullback_reclaim_signal,
    build_signal_board,
)

__all__ = [
    "EntrySignalConfig",
    "breakout_signal",
    "pullback_reclaim_signal",
    "build_signal_board",
]
