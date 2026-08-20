"""Server-owned freshness policy for portfolio runtime snapshots."""

from __future__ import annotations

import datetime as dt


def snapshot_freshness(
    asof: str,
    *,
    stale_after_days: int,
    today: dt.date | None = None,
) -> str:
    """Return fresh/stale from the persisted snapshot date and configured age."""
    try:
        snapshot_date = dt.date.fromisoformat(asof)
    except (TypeError, ValueError):
        return "stale"
    current_date = today or dt.date.today()
    return (
        "stale" if (current_date - snapshot_date).days > stale_after_days else "fresh"
    )
