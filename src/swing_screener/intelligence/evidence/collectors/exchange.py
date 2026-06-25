from __future__ import annotations

import json
import time
from datetime import date
from pathlib import Path
from typing import Callable

from swing_screener.data.source_health import ProbeResult, SourceDescriptor
from swing_screener.intelligence.evidence.config import EvidenceConfig, load_evidence_config
from swing_screener.intelligence.evidence.models import SourceEvidence
from swing_screener.intelligence.evidence.rss import FeedEntry, fetch_feed

_CATALOG_PATH = Path("data/intelligence/source_catalog.json")
_US_MICS = {"XNAS", "XNYS", "XASE", "ARCX", "BATS", "XOTC"}


def _default_fetch(cfg: EvidenceConfig) -> Callable[[str], list[FeedEntry]]:
    return lambda url: fetch_feed(
        url,
        user_agent=cfg.user_agent,
        connect_timeout=cfg.connect_timeout_seconds,
        read_timeout=cfg.read_timeout_seconds,
    )


def _default_mic_resolver(ticker: str) -> str | None:
    from swing_screener.data.instrument_enrichment import enrich_symbol

    record = enrich_symbol(ticker)
    return record.get("exchange_mic") if record else None


def _load_catalog(catalog_path: Path) -> dict:
    try:
        return json.loads(Path(catalog_path).read_text())
    except (OSError, ValueError):
        return {}


class ExchangeAnnouncementsCollector:
    SOURCE_ID = "exchange_announcements"

    @classmethod
    def describe(cls) -> SourceDescriptor:
        return SourceDescriptor(
            id=cls.SOURCE_ID,
            display_name="Exchange Announcements",
            domain="intelligence",
            role="primary",
            requires=None,
            configured=True,
            probeable=True,
            canary_market="eu",
            note="EU exchange regulatory RSS (US MICs skipped)",
        )

    @classmethod
    def collect(
        cls,
        ticker: str,
        *,
        asof_date: date,
        cfg: EvidenceConfig,
        fetch: Callable[[str], list[FeedEntry]] | None = None,
        mic_resolver: Callable[[str], str | None] | None = None,
        catalog_path: Path | None = None,
    ) -> list[SourceEvidence]:
        mic_resolver = mic_resolver or _default_mic_resolver
        mic = mic_resolver(ticker)
        if not mic or mic in _US_MICS:
            return []
        feeds = (_load_catalog(catalog_path or _CATALOG_PATH).get("exchange") or {}).get(mic, [])
        if not feeds:
            return []
        fetch = fetch or _default_fetch(cfg)
        out: list[SourceEvidence] = []
        for url in feeds:
            for entry in fetch(url):
                out.append(
                    SourceEvidence(
                        title=entry.title,
                        url=entry.url,
                        publisher=f"Exchange {mic}",
                        published_at=entry.published_at,
                        quote_or_summary=entry.summary or entry.title,
                        relevance="exchange notice",
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
            detail = f"{len(items)} exchange items" if items else "no EU feed resolved for canary"
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
