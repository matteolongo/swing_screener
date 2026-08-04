from __future__ import annotations

import json
import logging
import tempfile
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Callable

from swing_screener.data.source_health import record_fallback
from swing_screener.intelligence.evidence import registry

# Importing the collectors package auto-imports every collector module, whose
# @register decorators populate the registry (the single source of truth).
from swing_screener.intelligence.evidence import collectors as _collectors  # noqa: F401
from swing_screener.intelligence.evidence.config import EvidenceConfig, load_evidence_config
from swing_screener.intelligence.evidence.curation import curate
from swing_screener.intelligence.evidence.models import SourceEvidence

logger = logging.getLogger(__name__)

__all__ = [
    "EvidenceCacheSummary",
    "attempted_source_ids",
    "collect_evidence",
    "read_latest_cached_evidence_summary",
]

_CACHE_ROOT = Path("data/intelligence/evidence")


@dataclass(frozen=True)
class EvidenceCacheSummary:
    """Read-only metadata for the newest valid persisted evidence cache."""

    ticker: str
    cached_at: str
    item_count: int
    providers: list[str]
    freshness_status: str


def attempted_source_ids(cfg: EvidenceConfig, *, refresh_sources: bool = False) -> list[str]:
    collectors = registry.get_registered()
    attempted: list[str] = []
    for source_id in cfg.enabled_sources:
        collector = collectors.get(source_id)
        if collector is None:
            continue
        if getattr(collector, "REFRESH_ONLY", False) and not refresh_sources:
            continue
        attempted.append(source_id)
    return sorted(attempted)


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
    temporary_path: Path | None = None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = [
            {
                **item.model_dump(),
                **({"source_id": item.source_id} if item.source_id else {}),
            }
            for item in items
        ]
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            json.dump(payload, temporary)
            temporary_path = Path(temporary.name)
        temporary_path.replace(path)
    except OSError:
        logger.warning("Failed to write evidence cache %s", path, exc_info=True)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink(missing_ok=True)


def read_latest_cached_evidence_summary(
    ticker: str,
    *,
    cache_root: Path | None = None,
    current_date: date | None = None,
    cfg: EvidenceConfig | None = None,
) -> EvidenceCacheSummary | None:
    """Return metadata for the newest valid cache without collecting evidence."""
    root = cache_root or _CACHE_ROOT
    current_date = current_date or datetime.now(timezone.utc).date()
    cfg = cfg or load_evidence_config()
    normalized = ticker.strip().upper()
    if not normalized or not root.exists():
        return None

    dated_directories: list[tuple[date, Path]] = []
    try:
        for directory in root.iterdir():
            if not directory.is_dir():
                continue
            try:
                dated_directories.append((date.fromisoformat(directory.name), directory))
            except ValueError:
                continue
    except OSError:
        return None

    for cached_date, directory in sorted(dated_directories, reverse=True):
        items = _read_cache(directory / f"{normalized}.json")
        if items is None:
            continue
        cache_age_days = (current_date - cached_date).days
        freshness_status = (
            "fresh"
            if cache_age_days == 0
            else "cached"
            if 0 < cache_age_days <= cfg.cache_stale_after_days
            else "stale"
        )
        return EvidenceCacheSummary(
            ticker=normalized,
            cached_at=cached_date.isoformat(),
            item_count=len(items),
            providers=sorted({item.publisher for item in items if item.publisher}),
            freshness_status=freshness_status,
        )
    return None


def collect_evidence(
    ticker: str,
    *,
    asof_date: date | None = None,
    cfg: EvidenceConfig | None = None,
    cache_root: Path | None = None,
    refresh_sources: bool = False,
    attempt_callback: Callable[[str, str, int], None] | None = None,
) -> list[SourceEvidence]:
    asof_date = asof_date or datetime.now(timezone.utc).date()
    cfg = cfg or load_evidence_config()
    cache_root = cache_root or _CACHE_ROOT
    ticker = ticker.strip().upper()

    cache_file = _cache_file(cache_root, asof_date, ticker)
    cached = None if refresh_sources else _read_cache(cache_file)
    if cached is not None:
        return cached

    prior_cache = _read_cache(cache_file) if refresh_sources else None
    raw: list[SourceEvidence] = []
    successful_sources: set[str] = set()
    failed_sources: set[str] = set()
    collectors = registry.get_registered()
    for source_id in attempted_source_ids(cfg, refresh_sources=refresh_sources):
        collector = collectors.get(source_id)
        if collector is None:
            continue
        try:
            collected = collector.collect(ticker, asof_date=asof_date, cfg=cfg)
            raw.extend(
                item.model_copy(update={"source_id": source_id}) for item in collected
            )
            successful_sources.add(source_id)
            if attempt_callback is not None:
                attempt_callback(source_id, "fresh", len(collected))
        except Exception as exc:  # never fail the analysis
            logger.warning("Evidence collector %s failed for %s: %s", source_id, ticker, exc)
            record_fallback(domain="intelligence", from_provider=source_id, reason=str(exc), tickers=[ticker])
            failed_sources.add(source_id)
            if attempt_callback is not None:
                attempt_callback(source_id, "failed", 0)

    retained = (
        [
            item
            for item in prior_cache or []
            if item.source_id is None or item.source_id in failed_sources
        ]
        if refresh_sources and successful_sources
        else []
    )
    curated = curate(
        [*raw, *retained],
        window_days=cfg.recency_window_days,
        max_items=cfg.max_items_per_symbol,
        asof_date=asof_date,
    )
    if not refresh_sources or successful_sources:
        _write_cache(cache_file, curated)
    return curated
