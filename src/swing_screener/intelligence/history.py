"""Durable per-symbol analysis history.

Each successful analysis appends a compact entry to
`data/intelligence/history/{TICKER}.json` (a newest-first list capped at
`max_entries`). The list is read back as a digest fed into the LLM prompt and
exposed to the UI timeline. All operations degrade-soft: a read/write failure
never propagates into the analysis flow.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from pydantic import BaseModel, Field

from swing_screener.intelligence.models import PreOpenOutlook, SymbolIntelligence
from swing_screener.settings.paths import data_dir

logger = logging.getLogger(__name__)


class HistoryEntry(BaseModel):
    generated_at: str
    action: str
    conviction: str
    summary_line: str
    watch_for: list[str] = Field(default_factory=list)
    pre_open_outlook: PreOpenOutlook | None = None


def _watch_for(result: SymbolIntelligence) -> list[str]:
    """The forward-looking claims a future run should check against. Prefer the
    model's prediction_bullets (time-bound, checkable) over generic risk_factors,
    which are standing thesis risks rather than 'what to watch'."""
    if result.prediction_bullets:
        return [pb.reason for pb in result.prediction_bullets[:2]]
    return list(result.risk_factors[:2])


def entry_from_result(result: SymbolIntelligence) -> HistoryEntry:
    return HistoryEntry(
        generated_at=result.generated_at,
        action=str(result.action),
        conviction=str(result.conviction),
        summary_line=result.summary_line,
        watch_for=_watch_for(result),
        pre_open_outlook=result.pre_open_outlook,
    )


def _history_path(root: Path, ticker: str) -> Path:
    return root / "history" / f"{ticker.upper()}.json"


def read_history(
    ticker: str,
    *,
    limit: int | None = None,
    history_root: Path | None = None,
) -> list[HistoryEntry]:
    """Return stored entries for `ticker`, newest-first. Empty on miss/corruption."""
    root = history_root or data_dir() / "intelligence"
    path = _history_path(root, ticker)
    if not path.exists():
        return []
    try:
        raw = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return []
    if not isinstance(raw, list):
        return []
    # Validate per-entry so one corrupt / old-schema row doesn't discard the
    # whole file (a ValidationError is a ValueError subclass).
    entries: list[HistoryEntry] = []
    for d in raw:
        try:
            entries.append(HistoryEntry.model_validate(d))
        except (ValueError, TypeError):
            logger.warning("Skipping malformed history entry for %r", ticker)
            continue
    return entries[:limit] if limit is not None else entries


def append_history(
    ticker: str,
    result: SymbolIntelligence,
    *,
    max_entries: int,
    history_root: Path | None = None,
) -> None:
    """Prepend an entry derived from `result`, capping the list at `max_entries`.

    A re-run on the same calendar day replaces that day's entry rather than
    stacking, so the digest stays a cross-day record instead of filling with
    same-session reruns.
    """
    root = history_root or data_dir() / "intelligence"
    path = _history_path(root, ticker)
    try:
        new_entry = entry_from_result(result)
        new_day = new_entry.generated_at[:10]
        existing = [
            e
            for e in read_history(ticker, history_root=history_root)
            if e.generated_at[:10] != new_day
        ]
        updated = [new_entry, *existing][: max(0, max_entries)]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps([e.model_dump(mode="json") for e in updated], indent=2)
        )
    except OSError:
        logger.warning(
            "Failed to append intelligence history for %r", ticker, exc_info=True
        )
