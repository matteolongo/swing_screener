from __future__ import annotations

from datetime import date, datetime, timedelta

from swing_screener.intelligence.evidence.models import SourceEvidence


def _parse_date(value: str | None) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            return None


def _norm_key(item: SourceEvidence) -> tuple[str, str]:
    title = " ".join(str(item.title or "").lower().split())
    url = str(item.url or "").strip().lower().rstrip("/")
    return (title, url)


def curate(
    items: list[SourceEvidence], *, window_days: int, max_items: int, asof_date: date
) -> list[SourceEvidence]:
    """Filter to [asof_date - window, asof_date], dedup, newest-first, cap.

    Items with no parseable published_at are dropped (recency-only ranking
    cannot place them).
    """
    cutoff = asof_date - timedelta(days=window_days)
    seen: set[tuple[str, str]] = set()
    kept: list[tuple[date, SourceEvidence]] = []
    for item in items:
        d = _parse_date(item.published_at)
        if d is None or d < cutoff or d > asof_date:
            continue
        key = _norm_key(item)
        if key in seen:
            continue
        seen.add(key)
        kept.append((d, item))
    kept.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in kept[:max_items]]
