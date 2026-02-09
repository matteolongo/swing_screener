from __future__ import annotations

from collections import Counter
from typing import Iterable


def sector_concentration_warnings(
    tickers: Iterable[str],
    sector_map: dict[str, str | None],
    *,
    min_candidates: int = 5,
    threshold: float = 0.4,
) -> list[str]:
    """
    Build warnings for sector concentration among candidates.
    Only considers tickers with non-empty sector values.
    """
    sectors = []
    for t in tickers:
        sector = sector_map.get(str(t))
        if sector:
            sectors.append(sector)

    if len(sectors) < min_candidates:
        return []

    counts = Counter(sectors)
    sector, count = counts.most_common(1)[0]
    share = count / len(sectors)

    if share >= threshold:
        return [
            f"Sector concentration: {sector} is {share:.0%} of candidates ({count}/{len(sectors)})."
        ]

    return []
