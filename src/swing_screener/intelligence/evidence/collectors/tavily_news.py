"""Tavily search collector for explicit intelligence refreshes.

This collector is intentionally refresh-only. It can use web search credits, so
normal symbol analysis must not call it unless a user explicitly asks to refresh
app sources.
"""
from __future__ import annotations

import os
from datetime import date
from typing import Callable

import httpx

from swing_screener.data.source_health import SourceDescriptor
from swing_screener.intelligence.evidence.config import EvidenceConfig
from swing_screener.intelligence.evidence.models import SourceEvidence
from swing_screener.intelligence.evidence.registry import register

_BASE_URL = "https://api.tavily.com/search"
_ENV_KEY = "TAVILY_API_KEY"


def _default_search(query: str, *, cfg: EvidenceConfig, api_key: str) -> dict:
    timeout = httpx.Timeout(
        connect=cfg.connect_timeout_seconds,
        read=cfg.read_timeout_seconds,
        write=cfg.read_timeout_seconds,
        pool=cfg.read_timeout_seconds,
    )
    payload = {
        "query": query,
        "topic": "news",
        "search_depth": "basic",
        "max_results": cfg.max_items_per_symbol,
        "days": cfg.recency_window_days,
        "include_answer": False,
        "include_raw_content": False,
    }
    with httpx.Client(timeout=timeout) as client:
        response = client.post(
            _BASE_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
    if not isinstance(data, dict):
        raise ValueError("Unexpected Tavily search response")
    return data


def _query_for(ticker: str, asof_date: date) -> str:
    symbol = ticker.strip().upper()
    return (
        f"{symbol} stock news why shares moved earnings analyst guidance "
        f"macro geopolitical risk as of {asof_date.isoformat()}"
    )


@register
class TavilyNewsCollector:
    SOURCE_ID = "tavily_news"
    REFRESH_ONLY = True

    @classmethod
    def describe(cls) -> SourceDescriptor:
        configured = bool(os.getenv(_ENV_KEY))
        return SourceDescriptor(
            id=cls.SOURCE_ID,
            display_name="Tavily (search)",
            domain="intelligence",
            role="refresh",
            requires=_ENV_KEY,
            configured=configured,
            probeable=False,
            canary_market="us",
            note="manual refresh search for news, move explanations, and macro risk",
        )

    @classmethod
    def collect(
        cls,
        ticker: str,
        *,
        asof_date: date,
        cfg: EvidenceConfig,
        search_fn: Callable[..., dict] | None = None,
    ) -> list[SourceEvidence]:
        api_key = os.getenv(_ENV_KEY)
        if not api_key and search_fn is None:
            return []
        search = search_fn or _default_search
        payload = search(_query_for(ticker, asof_date), cfg=cfg, api_key=api_key or "")

        out: list[SourceEvidence] = []
        for item in payload.get("results") or []:
            url = item.get("url")
            if not url:
                continue
            title = item.get("title") or "(untitled)"
            summary = item.get("content") or item.get("snippet") or title
            out.append(
                SourceEvidence(
                    title=title,
                    url=url,
                    publisher=item.get("source") or item.get("publisher") or "Tavily",
                    published_at=item.get("published_date") or item.get("published_at"),
                    quote_or_summary=summary,
                    relevance="Tavily news · explicit refresh",
                )
            )
        return out
