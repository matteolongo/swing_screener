"""Aggregates data-source descriptors, runs probes, exposes fallback events.

This is the ONLY place that enumerates sources across domains. It reads from
the existing provider classes (no central registry in the core library).
To add a probeable source: implement describe()/probe() on the provider and
add it to _PROBEABLE below.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from swing_screener.data.providers.yfinance_provider import YfinanceProvider
from swing_screener.data.providers.stooq_provider import StooqDataProvider
from swing_screener.data.providers.alpaca_provider import AlpacaDataProvider
from swing_screener.fundamentals.providers.sec_edgar import SecEdgarFundamentalsProvider
from swing_screener.fundamentals.providers.yfinance import YfinanceFundamentalsProvider
from swing_screener.fundamentals.providers.degiro import DegiroFundamentalsProvider
from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
from swing_screener.data.source_health import (
    SourceDescriptor, ProbeResult, FallbackEvent, recent_events,
)
from swing_screener.settings import get_settings_manager
from swing_screener.intelligence.evidence.collectors.sec_edgar import SecEdgarCatalystCollector
from swing_screener.intelligence.evidence.collectors.company_ir import CompanyIrRssCollector
from swing_screener.intelligence.evidence.collectors.exchange import ExchangeAnnouncementsCollector

logger = logging.getLogger(__name__)

# id -> provider class exposing describe()/probe() classmethods
_PROBEABLE: dict[str, type] = {
    "yfinance": YfinanceProvider,
    "stooq": StooqDataProvider,
    "alpaca": AlpacaDataProvider,
    "sec_edgar": SecEdgarFundamentalsProvider,
    "yfinance_fundamentals": YfinanceFundamentalsProvider,
    "degiro": DegiroFundamentalsProvider,
    "finnhub": FinnhubEnrichmentClient,
    "sec_edgar_catalysts": SecEdgarCatalystCollector,
    "company_ir_rss": CompanyIrRssCollector,
    "exchange_announcements": ExchangeAnnouncementsCollector,
}

# The 3 remaining inert catalyst sources — no runtime adapter yet. Listed
# honestly so the page shows the gap rather than faking confidence.
INTELLIGENCE_SOURCES: list[SourceDescriptor] = [
    SourceDescriptor(id=sid, display_name=name, domain="intelligence", role="primary",
                     requires=None, configured=False, probeable=False, canary_market=None, note=note)
    for sid, name, note in [
        ("yahoo_finance", "Yahoo Finance (catalysts)", "declared — no runtime adapter"),
        ("earnings_calendar", "Earnings Calendar", "covered by days_to_earnings / next_earnings_date"),
        ("financial_news_rss", "Financial News RSS", "out of v1 scope — overlaps web_search"),
    ]
]

_DEFAULT_CANARY = {"us": "AAPL", "eu": "ASML.AS"}


class DatasourcesService:
    def __init__(self) -> None:
        self._probe_cache: dict[str, ProbeResult] = {}

    def _canary_map(self) -> dict[str, str]:
        try:
            defaults = get_settings_manager().load_defaults_document()
            cfg = defaults.get("low_level", {}).get("data_providers", {}).get("probe_canary", {})
            return {"us": cfg.get("us", _DEFAULT_CANARY["us"]), "eu": cfg.get("eu", _DEFAULT_CANARY["eu"])}
        except Exception:
            return dict(_DEFAULT_CANARY)

    def inventory(self) -> list[SourceDescriptor]:
        descriptors = [cls.describe() for cls in _PROBEABLE.values()]
        descriptors.extend(INTELLIGENCE_SOURCES)
        return descriptors

    def inventory_with_probes(self) -> list[tuple[SourceDescriptor, ProbeResult | None]]:
        return [(d, self._probe_cache.get(d.id)) for d in self.inventory()]

    def probe_one(self, source_id: str) -> ProbeResult:
        cls = _PROBEABLE.get(source_id)
        if cls is None:
            return ProbeResult(id=source_id, status="not_configured", detail="unknown or not probeable")
        descriptor = cls.describe()
        canary = self._canary_map().get(descriptor.canary_market or "us", _DEFAULT_CANARY["us"])
        result = cls.probe(canary)
        self._probe_cache[source_id] = result
        return result

    def probe_all(self) -> list[ProbeResult]:
        ids = [d.id for d in self.inventory() if d.probeable]
        results: list[ProbeResult] = []
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(self.probe_one, sid): sid for sid in ids}
            for future in as_completed(futures):
                sid = futures[future]
                try:
                    results.append(future.result())
                except Exception as exc:  # pragma: no cover - defensive
                    logger.warning("probe failed for %s: %s", sid, exc)
                    results.append(ProbeResult(id=sid, status="down", error=str(exc)))
        return results

    def events(self, limit: int | None = None) -> list[FallbackEvent]:
        return recent_events(limit)
