from __future__ import annotations

from swing_screener.intelligence.ingestion.base import IntelligenceEventProvider
from swing_screener.intelligence.ingestion.earnings_calendar import (
    EarningsCalendarEventProvider,
)
from swing_screener.intelligence.ingestion.yahoo_finance import YahooFinanceEventProvider


def build_intelligence_provider(name: str) -> IntelligenceEventProvider:
    normalized = str(name).strip().lower()
    if normalized == "yahoo_finance":
        return YahooFinanceEventProvider()
    if normalized == "earnings_calendar":
        return EarningsCalendarEventProvider()
    raise ValueError(f"Unsupported intelligence provider: {name}")

