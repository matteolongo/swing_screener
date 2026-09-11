from __future__ import annotations

import math
from collections import Counter
from collections.abc import Iterable


def sector_concentration_warnings(
    tickers: Iterable[str],
    sector_map: dict[str, str | None],
    *,
    min_candidates: int = 5,
    threshold: float = 0.4,
) -> list[str]:
    """
    Build warnings for named-sector concentration among unique candidates.

    Unknown sectors remain in the denominator but never form a warning group.
    """
    if min_candidates < 1:
        raise ValueError("min_candidates must be at least 1")
    if not math.isfinite(threshold) or not 0 <= threshold <= 1:
        raise ValueError("threshold must be a finite fraction between 0 and 1")

    unique_tickers = list(dict.fromkeys(str(ticker) for ticker in tickers))
    total_candidates = len(unique_tickers)
    if total_candidates < min_candidates:
        return []

    sectors = []
    for ticker in unique_tickers:
        raw_sector = sector_map.get(ticker)
        sector = str(raw_sector).strip() if raw_sector is not None else ""
        if sector:
            sectors.append(sector)

    if not sectors:
        return []

    counts = Counter(sectors)
    concentrated = [
        (sector, count, count / total_candidates)
        for sector, count in counts.items()
        if count / total_candidates >= threshold
    ]
    concentrated.sort(key=lambda item: (-item[2], item[0]))
    return [
        f"Sector concentration: {sector} is {share:.0%} of candidates "
        f"({count}/{total_candidates})."
        for sector, count, share in concentrated
    ]
