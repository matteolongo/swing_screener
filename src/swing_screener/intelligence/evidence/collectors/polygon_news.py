"""Polygon.io ticker-news catalyst collector.

Fetches recent news articles for a single ticker from Polygon's
``/v2/reference/news`` endpoint and maps them to ``SourceEvidence`` so they feed
the analyzer prompt alongside SEC EDGAR filings. On-demand, per-ticker: one HTTP
call per ``collect`` to keep API credit usage bounded.

Requires ``POLYGON_IO_API_KEY``. Without it the collector degrades to an empty
list rather than failing the analysis.
"""
from __future__ import annotations

import os
import time
from datetime import date, timedelta
from typing import Callable

import httpx

from swing_screener.data.source_health import ProbeResult, SourceDescriptor
from swing_screener.intelligence.evidence.config import EvidenceConfig
from swing_screener.intelligence.evidence.models import SourceEvidence

_BASE_URL = "https://api.polygon.io/v2/reference/news"
_ENV_KEY = "POLYGON_IO_API_KEY"

_SENTIMENT_LABELS = {
    "positive": "bullish",
    "negative": "bearish",
    "neutral": "neutral",
}


def _default_get_json(cfg: EvidenceConfig, api_key: str) -> Callable[[str], dict]:
    def _get(url: str) -> dict:
        timeout = httpx.Timeout(
            connect=cfg.connect_timeout_seconds,
            read=cfg.read_timeout_seconds,
            write=cfg.read_timeout_seconds,
            pool=cfg.read_timeout_seconds,
        )
        with httpx.Client(timeout=timeout) as client:
            response = client.get(url, headers={"Authorization": f"Bearer {api_key}"})
            response.raise_for_status()
            payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError(f"Unexpected Polygon news response for {url}")
        return payload

    return _get


def _sentiment_for(article: dict, ticker: str) -> str | None:
    for insight in article.get("insights") or []:
        if str(insight.get("ticker", "")).upper() == ticker.upper():
            return insight.get("sentiment")
    return None


class PolygonNewsCollector:
    SOURCE_ID = "polygon_news"

    @classmethod
    def describe(cls) -> SourceDescriptor:
        configured = bool(os.getenv(_ENV_KEY))
        return SourceDescriptor(
            id=cls.SOURCE_ID,
            display_name="Polygon.io (news)",
            domain="intelligence",
            role="enrichment",
            requires=_ENV_KEY,
            configured=configured,
            probeable=configured,
            canary_market="us",
            note="ticker news with per-symbol sentiment",
        )

    @classmethod
    def collect(
        cls,
        ticker: str,
        *,
        asof_date: date,
        cfg: EvidenceConfig,
        get_json: Callable[[str], dict] | None = None,
    ) -> list[SourceEvidence]:
        if get_json is None:
            api_key = os.getenv(_ENV_KEY)
            if not api_key:
                return []
            get_json = _default_get_json(cfg, api_key)

        symbol = ticker.strip().upper()
        since = (asof_date - timedelta(days=cfg.recency_window_days)).isoformat()
        url = (
            f"{_BASE_URL}?ticker={symbol}&published_utc.gte={since}"
            f"&order=desc&limit={cfg.max_items_per_symbol}"
        )
        payload = get_json(url)

        out: list[SourceEvidence] = []
        for article in payload.get("results") or []:
            article_url = article.get("article_url")
            if not article_url:
                continue
            publisher = (article.get("publisher") or {}).get("name")
            sentiment = _sentiment_for(article, symbol)
            label = _SENTIMENT_LABELS.get(str(sentiment).lower(), "neutral")
            reasoning = next(
                (
                    ins.get("sentiment_reasoning")
                    for ins in article.get("insights") or []
                    if str(ins.get("ticker", "")).upper() == symbol.upper()
                ),
                None,
            )
            summary = article.get("description") or reasoning or article.get("title") or ""
            out.append(
                SourceEvidence(
                    title=article.get("title") or "(untitled)",
                    url=article_url,
                    publisher=publisher,
                    published_at=article.get("published_utc"),
                    quote_or_summary=summary,
                    relevance=f"Polygon news · {label}",
                )
            )
        return out

    @classmethod
    def probe(cls, canary: str) -> ProbeResult:
        api_key = os.getenv(_ENV_KEY)
        if not api_key:
            return ProbeResult(id=cls.SOURCE_ID, status="not_configured")
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
                sample={
                    "symbol": canary,
                    "count": len(items),
                    "latest": items[0].published_at if items else None,
                },
            )
        except Exception as exc:
            elapsed = (time.perf_counter() - started) * 1000.0
            return ProbeResult(id=cls.SOURCE_ID, status="down", latency_ms=round(elapsed, 1), error=str(exc))
