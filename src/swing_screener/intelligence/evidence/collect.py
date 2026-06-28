from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path

from swing_screener.data.source_health import record_fallback
from swing_screener.intelligence.evidence.collectors.polygon_news import PolygonNewsCollector
from swing_screener.intelligence.evidence.collectors.sec_edgar import SecEdgarCatalystCollector
from swing_screener.intelligence.evidence.config import EvidenceConfig, load_evidence_config
from swing_screener.intelligence.evidence.curation import curate
from swing_screener.intelligence.evidence.models import SourceEvidence

logger = logging.getLogger(__name__)

_CACHE_ROOT = Path("data/intelligence/evidence")

_COLLECTORS = {
    SecEdgarCatalystCollector.SOURCE_ID: SecEdgarCatalystCollector,
    PolygonNewsCollector.SOURCE_ID: PolygonNewsCollector,
}


def _cache_file(cache_root: Path, asof_date: date, ticker: str) -> Path:
    return cache_root / asof_date.isoformat() / f"{ticker.upper()}.json"


def _read_cache(path: Path) -> list[SourceEvidence] | None:
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text())
        return [SourceEvidence(**d) for d in raw]
    except (OSError, ValueError, TypeError):
        return None


def _write_cache(path: Path, items: list[SourceEvidence]) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps([item.model_dump() for item in items]))
    except OSError:
        logger.warning("Failed to write evidence cache %s", path, exc_info=True)


def collect_evidence(
    ticker: str,
    *,
    asof_date: date | None = None,
    cfg: EvidenceConfig | None = None,
    cache_root: Path | None = None,
) -> list[SourceEvidence]:
    asof_date = asof_date or date.today()
    cfg = cfg or load_evidence_config()
    cache_root = cache_root or _CACHE_ROOT
    ticker = ticker.strip().upper()

    cache_file = _cache_file(cache_root, asof_date, ticker)
    cached = _read_cache(cache_file)
    if cached is not None:
        return cached

    raw: list[SourceEvidence] = []
    for source_id in cfg.enabled_sources:
        collector = _COLLECTORS.get(source_id)
        if collector is None:
            continue
        try:
            raw.extend(collector.collect(ticker, asof_date=asof_date, cfg=cfg))
        except Exception as exc:  # never fail the analysis
            logger.warning("Evidence collector %s failed for %s: %s", source_id, ticker, exc)
            record_fallback(domain="intelligence", from_provider=source_id, reason=str(exc), tickers=[ticker])

    curated = curate(
        raw, window_days=cfg.recency_window_days, max_items=cfg.max_items_per_symbol, asof_date=asof_date
    )
    _write_cache(cache_file, curated)
    return curated
