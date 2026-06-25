from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from swing_screener.settings.paths import data_dir

logger = logging.getLogger(__name__)


def record_analysis_metrics(
    ticker: str,
    *,
    tokens: int | None,
    metrics_root: Path | None = None,
) -> None:
    """Append one entry to data/intelligence/intelligence_metrics.json.

    Degrades soft: any I/O or parse error is logged and swallowed so a metrics
    failure never interrupts the analysis pipeline.
    """
    root = metrics_root or data_dir() / "intelligence"
    path = root / "intelligence_metrics.json"
    try:
        existing = json.loads(path.read_text()) if path.exists() else []
        if not isinstance(existing, list):
            existing = []
        existing.append({"ts": datetime.now(timezone.utc).isoformat(), "ticker": ticker.upper(), "tokens": tokens})
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(existing[-500:], indent=2))
    except (OSError, ValueError):
        logger.warning(
            "Failed to record intelligence metrics for %r", ticker, exc_info=True
        )
