from __future__ import annotations

import datetime as dt
from collections.abc import Callable

from api.models.strategic_review import StrategicReviewRequest
from swing_screener.intelligence.cache import read_from_cache
from swing_screener.intelligence.evidence.collect import collect_evidence
from swing_screener.intelligence.evidence.models import SourceEvidence
from swing_screener.intelligence.models import SymbolIntelligence
from swing_screener.intelligence.strategic import (
    MarketContext,
    StrategicIntelligenceAgent,
    StrategicIntelligenceReport,
    StrategicIntelligenceRequest,
    StrategicSignal,
    WatchedSymbolContext,
)
from swing_screener.intelligence.strategic.signal_adapter import (
    signals_from_symbol_intelligence,
    watched_context_from_symbol_intelligence,
)


class StrategicReviewService:
    """Build a manual strategic overlay from app-owned context only."""

    def __init__(
        self,
        *,
        read_intelligence_fn: Callable[[str], SymbolIntelligence | None] = read_from_cache,
        collect_evidence_fn: Callable[[str], list[SourceEvidence]] | None = None,
        now_fn: Callable[[], str] | None = None,
        agent: StrategicIntelligenceAgent | None = None,
    ) -> None:
        self._read_intelligence = read_intelligence_fn
        self._collect_evidence = collect_evidence_fn or (lambda ticker: collect_evidence(ticker, refresh_sources=True))
        self._now = now_fn or (lambda: dt.datetime.now(dt.UTC).isoformat())
        self._agent = agent or StrategicIntelligenceAgent()

    def review(self, request: StrategicReviewRequest) -> StrategicIntelligenceReport:
        intelligence = self._read_intelligence(request.ticker)
        refreshed_evidence = self._collect_evidence(request.ticker) if request.refresh_sources else []
        strategic_request = StrategicIntelligenceRequest(
            topic=request.topic,
            signals=[
                *(_signals_from_intelligence(intelligence) if intelligence else []),
                *[_signal_from_evidence(request.ticker, item) for item in refreshed_evidence],
            ],
            watchlist=[
                watched_context_from_symbol_intelligence(intelligence)
                if intelligence
                else WatchedSymbolContext(symbol=request.ticker, source_bucket="cached_intelligence")
            ],
            market_context=MarketContext(
                timeframe="manual",
                horizon_days=request.horizon_days,
                risk_mode=request.risk_mode,
            ),
        )
        report = self._agent.analyze(strategic_request)
        return report.model_copy(
            update={
                "generated_at": self._now(),
                "external_source_count": len(refreshed_evidence),
            }
        )


def _signals_from_intelligence(intelligence: SymbolIntelligence) -> list[StrategicSignal]:
    return signals_from_symbol_intelligence(intelligence)


def _signal_from_evidence(ticker: str, evidence: SourceEvidence) -> StrategicSignal:
    relevance = evidence.relevance.lower()
    tags = ["refreshed_evidence", *_tags_from_text(f"{evidence.title} {evidence.quote_or_summary} {relevance}")]
    return StrategicSignal(
        title=evidence.title,
        summary=evidence.quote_or_summary,
        source=evidence.publisher or "app_evidence",
        timestamp=evidence.published_at,
        url=evidence.url,
        symbols=[ticker],
        tags=tags,
        confidence=0.65,
    )


def _tags_from_text(text: str) -> list[str]:
    lowered = text.lower()
    tags: list[str] = []
    if any(token in lowered for token in ("export", "regulation", "policy", "tariff")):
        tags.append("regulation")
    if any(token in lowered for token in ("ai", "capex", "datacenter", "infrastructure")):
        tags.append("ai_capex")
    if any(token in lowered for token in ("semiconductor", "chip", "equipment")):
        tags.append("semiconductors")
    if any(token in lowered for token in ("earnings", "guidance", "estimate")):
        tags.append("earnings")
    return tags or ["news"]
