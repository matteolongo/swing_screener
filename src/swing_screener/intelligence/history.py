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


def entry_from_result(result: SymbolIntelligence) -> HistoryEntry:
    return HistoryEntry(
        generated_at=result.generated_at,
        action=str(result.action),
        conviction=str(result.conviction),
        summary_line=result.summary_line,
        watch_for=list(result.risk_factors[:2]),
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
        entries = [HistoryEntry.model_validate(d) for d in raw]
    except (json.JSONDecodeError, OSError, ValueError, TypeError):
        return []
    return entries[:limit] if limit is not None else entries


def append_history(
    ticker: str,
    result: SymbolIntelligence,
    *,
    max_entries: int,
    history_root: Path | None = None,
) -> None:
    """Prepend an entry derived from `result`, capping the list at `max_entries`."""
    root = history_root or data_dir() / "intelligence"
    path = _history_path(root, ticker)
    try:
        existing = read_history(ticker, history_root=history_root)
        updated = [entry_from_result(result), *existing][: max(0, max_entries)]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps([e.model_dump() for e in updated], indent=2))
    except OSError:
        logger.warning(
            "Failed to append intelligence history for %r", ticker, exc_info=True
        )
