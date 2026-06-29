"""DeGiro company news catalyst collector.

Fetches recent news for a single ticker from DeGiro's news-by-company endpoint
using the ISIN map populated by the portfolio audit. Covers EU equities that
Polygon.io and SEC EDGAR miss entirely.

Requires DEGIRO_USERNAME and DEGIRO_PASSWORD. Without them the collector
degrades to an empty list rather than failing the analysis.
"""
from __future__ import annotations

import logging
import time
from datetime import date, timedelta
from typing import Any

from swing_screener.data.source_health import ProbeResult, SourceDescriptor
from swing_screener.intelligence.evidence.config import EvidenceConfig
from swing_screener.intelligence.evidence.models import SourceEvidence

logger = logging.getLogger(__name__)

_SOURCE_ID = "degiro_news"
_DEFAULT_LANGUAGE = "en,nl,de,fr,es,it"

_client_singleton: Any = None


def _get_client() -> Any | None:
    global _client_singleton
    if _client_singleton is not None:
        return _client_singleton
    try:
        from swing_screener.integrations.degiro.credentials import (
            credentials_configured,
            load_credentials,
        )
        from swing_screener.integrations.degiro.client import DegiroClient
    except ImportError:
        return None

    if not credentials_configured():
        return None

    try:
        client = DegiroClient(load_credentials())
        client.connect()
        _client_singleton = client
        return client
    except Exception as exc:
        logger.warning("degiro_news: client connect failed: %s", exc)
        return None


def _resolve_isin(ticker: str) -> str | None:
    try:
        from swing_screener.fundamentals.providers.degiro import _load_isin_map
        isin_map = _load_isin_map()
        isin = isin_map.get(ticker)
        if not isin:
            base = ticker.split(".")[0]
            isin = isin_map.get(base)
        return isin
    except Exception:
        return None


class DegiroNewsCollector:
    SOURCE_ID = _SOURCE_ID

    @classmethod
    def describe(cls) -> SourceDescriptor:
        try:
            from swing_screener.integrations.degiro.credentials import credentials_configured
            configured = credentials_configured()
        except ImportError:
            configured = False
        return SourceDescriptor(
            id=cls.SOURCE_ID,
            display_name="DEGIRO (news)",
            domain="intelligence",
            role="enrichment",
            requires="DEGIRO_USERNAME + DEGIRO_PASSWORD",
            configured=configured,
            probeable=configured,
            canary_market="eu",
            note="company news via DeGiro, covers EU equities",
        )

    @classmethod
    def collect(
        cls,
        ticker: str,
        *,
        asof_date: date,
        cfg: EvidenceConfig,
        **_kwargs: Any,
    ) -> list[SourceEvidence]:
        client = _get_client()
        if client is None:
            return []

        isin = _resolve_isin(ticker.strip().upper())
        if not isin:
            logger.debug("degiro_news: no ISIN for %r; skipping", ticker)
            return []

        try:
            from degiro_connector.trading.models.news import NewsRequest
            req = NewsRequest(
                isin=isin,
                limit=cfg.max_items_per_symbol,
                offset=0,
                languages=_DEFAULT_LANGUAGE,
            )
            batch = client.api.get_news_by_company(news_request=req, raw=False)
        except Exception as exc:
            logger.warning("degiro_news: fetch failed for %r (ISIN %s): %s", ticker, isin, exc)
            return []

        if batch is None:
            return []

        cutoff = asof_date - timedelta(days=cfg.recency_window_days)
        out: list[SourceEvidence] = []
        for item in (batch.items or []):
            try:
                item_date = item.date.date() if hasattr(item.date, "date") else item.date
                if item_date < cutoff:
                    continue
            except Exception:
                pass
            summary = item.brief or (item.content[:300] if item.content else "") or item.title
            out.append(
                SourceEvidence(
                    title=item.title,
                    url=f"https://www.degiro.eu/news/{item.id}",
                    publisher=item.provider,
                    published_at=item.date.isoformat() if item.date else None,
                    quote_or_summary=summary,
                    relevance=f"DeGiro news · {item.category or 'general'}",
                )
            )

        return out

    @classmethod
    def probe(cls, canary: str) -> ProbeResult:
        client = _get_client()
        if client is None:
            return ProbeResult(id=cls.SOURCE_ID, status="not_configured")

        isin = _resolve_isin(canary.upper())
        if not isin:
            return ProbeResult(
                id=cls.SOURCE_ID,
                status="degraded",
                detail=f"no ISIN in map for {canary!r}; populate via portfolio sync",
            )

        from swing_screener.intelligence.evidence.config import load_evidence_config
        cfg = load_evidence_config()
        started = time.perf_counter()
        try:
            items = cls.collect(canary, asof_date=date.today(), cfg=cfg)
            elapsed = (time.perf_counter() - started) * 1000.0
            return ProbeResult(
                id=cls.SOURCE_ID,
                status="ok",
                latency_ms=round(elapsed, 1),
                detail=f"{len(items)} recent articles",
                sample={"symbol": canary, "isin": isin, "count": len(items)},
            )
        except Exception as exc:
            elapsed = (time.perf_counter() - started) * 1000.0
            return ProbeResult(id=cls.SOURCE_ID, status="down", latency_ms=round(elapsed, 1), error=str(exc))
