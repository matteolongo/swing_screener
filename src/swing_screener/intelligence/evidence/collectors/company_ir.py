from __future__ import annotations

import json
import time
from datetime import date
from pathlib import Path
from typing import Callable

from swing_screener.data.source_health import ProbeResult, SourceDescriptor
from swing_screener.intelligence.evidence.config import EvidenceConfig, load_evidence_config
from swing_screener.intelligence.evidence.discovery import cached_discover
from swing_screener.intelligence.evidence.models import SourceEvidence
from swing_screener.intelligence.evidence.rss import FeedEntry, fetch_feed

_IR_FEEDS_PATH = Path("data/intelligence/ir_feeds.json")


def _default_fetch(cfg: EvidenceConfig) -> Callable[[str], list[FeedEntry]]:
    return lambda url: fetch_feed(
        url,
        user_agent=cfg.user_agent,
        connect_timeout=cfg.connect_timeout_seconds,
        read_timeout=cfg.read_timeout_seconds,
    )


def _load_feeds(feeds_path: Path) -> dict[str, list[str]]:
    try:
        return json.loads(Path(feeds_path).read_text())
    except (OSError, ValueError):
        return {}


class CompanyIrRssCollector:
    SOURCE_ID = "company_ir_rss"

    @classmethod
    def describe(cls) -> SourceDescriptor:
        return SourceDescriptor(
            id=cls.SOURCE_ID,
            display_name="Company IR RSS",
            domain="intelligence",
            role="primary",
            requires=None,
            configured=True,
            probeable=True,
            canary_market="us",
            note="official IR RSS, seed-mapped tickers",
        )

    @classmethod
    def collect(
        cls,
        ticker: str,
        *,
        asof_date: date,
        cfg: EvidenceConfig,
        fetch: Callable[[str], list[FeedEntry]] | None = None,
        feeds_path: Path | None = None,
        discover: Callable[[str], str | None] | None = None,
    ) -> list[SourceEvidence]:
        fetch = fetch or _default_fetch(cfg)
        key = ticker.strip().upper()
        feeds = _load_feeds(feeds_path or _IR_FEEDS_PATH).get(key, [])
        if not feeds and cfg.discovery_enabled:
            discover = discover or (lambda t: cached_discover(t, cfg=cfg, asof_date=asof_date))
            discovered = discover(key)
            if discovered:
                feeds = [discovered]
        out: list[SourceEvidence] = []
        for url in feeds:
            for entry in fetch(url):
                out.append(
                    SourceEvidence(
                        title=entry.title,
                        url=entry.url,
                        publisher="Company IR",
                        published_at=entry.published_at,
                        quote_or_summary=entry.summary or entry.title,
                        relevance="official IR release",
                    )
                )
        return out

    @classmethod
    def probe(cls, canary: str) -> ProbeResult:
        started = time.perf_counter()
        cfg = load_evidence_config()
        try:
            items = cls.collect(canary, asof_date=date.today(), cfg=cfg)
            elapsed = (time.perf_counter() - started) * 1000.0
            status = "ok" if items else "not_configured"
            detail = f"{len(items)} IR items" if items else "no seed feed for canary"
            return ProbeResult(
                id=cls.SOURCE_ID,
                status=status,
                latency_ms=round(elapsed, 1),
                detail=detail,
                sample={"symbol": canary, "count": len(items)},
            )
        except Exception as exc:
            elapsed = (time.perf_counter() - started) * 1000.0
            return ProbeResult(id=cls.SOURCE_ID, status="down", latency_ms=round(elapsed, 1), error=str(exc))
