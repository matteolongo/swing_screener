from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from swing_screener.settings.paths import data_dir
from swing_screener.utils.file_lock import FileLockTimeoutError, open_locked_text

logger = logging.getLogger(__name__)

_MAX_ENTRIES = 500


def record_analysis_metrics(
    ticker: str,
    *,
    tokens: int | None,
    metrics_root: Path | None = None,
) -> bool:
    """Append one entry to data/intelligence/intelligence_metrics.json.

    The read-modify-write runs under an exclusive file lock so concurrent
    analyses cannot drop each other's entries. Degrades soft: a failure is
    logged and reported as False, never raised into the analysis pipeline.
    """
    root = metrics_root or data_dir() / "intelligence"
    path = root / "intelligence_metrics.json"
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "ticker": ticker.upper(),
        "tokens": tokens,
    }
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open_locked_text(path, mode="r+", lock_kind="exclusive", create_file=True) as fh:
            raw = fh.read()
            try:
                existing = json.loads(raw) if raw.strip() else []
            except ValueError:
                existing = []
            if not isinstance(existing, list):
                existing = []
            existing.append(entry)
            fh.seek(0)
            fh.truncate()
            json.dump(existing[-_MAX_ENTRIES:], fh, indent=2)
            fh.flush()
    except (OSError, ValueError, FileLockTimeoutError):
        logger.warning(
            "Failed to record intelligence metrics for %r", ticker, exc_info=True
        )
        return False
    return True
