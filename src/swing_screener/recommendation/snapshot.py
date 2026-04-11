"""Unified symbol analysis snapshot — consistency check across data layers."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


@dataclass
class SourceMeta:
    layer: str          # "technical" | "fundamentals" | "intelligence"
    asof_date: date | None
    is_fresh: bool      # True if asof_date == reference date


@dataclass
class SymbolAnalysisSnapshot:
    symbol: str
    reference_date: date
    source_meta: list[SourceMeta]
    warnings: list[str]
    is_consistent_snapshot: bool


def build_symbol_analysis_snapshot(
    symbol: str,
    reference_date: date,
    source_dates: dict[str, date | None],
) -> SymbolAnalysisSnapshot:
    """Build a snapshot consistency summary from per-layer asof dates.

    Args:
        symbol: The ticker symbol.
        reference_date: Canonical analysis date (typically the screener run date).
        source_dates: Maps layer name → asof date for that layer (None = unavailable).

    Returns:
        SymbolAnalysisSnapshot with is_consistent_snapshot=True only when every
        *present* layer shares the reference_date. Layers with asof_date=None are
        noted in source_meta but do not trigger a consistency failure.
    """
    meta: list[SourceMeta] = []
    warnings: list[str] = []
    consistent = True

    for layer, asof in source_dates.items():
        is_fresh = asof is not None and asof == reference_date
        meta.append(SourceMeta(layer=layer, asof_date=asof, is_fresh=is_fresh))
        if asof is not None and asof != reference_date:
            consistent = False
            delta_days = (reference_date - asof).days
            direction = "before" if delta_days >= 0 else "after"
            abs_days = abs(delta_days)
            warnings.append(
                f"{layer} data is from {asof.isoformat()} "
                f"({abs_days} day(s) {direction} reference date {reference_date.isoformat()})"
            )

    return SymbolAnalysisSnapshot(
        symbol=symbol,
        reference_date=reference_date,
        source_meta=meta,
        warnings=warnings,
        is_consistent_snapshot=consistent,
    )
