"""Fill a SymbolIntelligenceRequest with fundamentals/Finnhub/earnings before the LLM call.

Auto-fetch, block: missing fields are fetched synchronously. Provider failures degrade
to leaving the field None rather than failing the analysis.
"""
from __future__ import annotations

import logging
from typing import Callable, Protocol

from swing_screener.intelligence.models import SymbolIntelligenceRequest

logger = logging.getLogger(__name__)

# Snapshot field name -> request field name. Same name on both sides here.
_SNAPSHOT_FIELDS = (
    "sector",
    "trailing_pe",
    "revenue_growth_yoy",
    "gross_margin",
    "net_margin",
    "return_on_equity",
    "debt_to_equity",
    "insider_net_shares_90d",
    "insider_transaction_count_90d",
    "forward_eps_estimate",
    "analyst_upgrade_downgrade_net_30d",
)


class _FundamentalsLike(Protocol):
    def get_snapshot(self, symbol: str): ...


def enrich_intelligence_request(
    ticker: str,
    request: SymbolIntelligenceRequest,
    *,
    fundamentals: _FundamentalsLike | None = None,
    earnings: Callable[[str], tuple[int | None, str | None]] | None = None,
) -> SymbolIntelligenceRequest:
    updates: dict = {}

    if fundamentals is not None:
        try:
            snap = fundamentals.get_snapshot(ticker)
        except Exception as exc:  # degrade, never fail the analysis
            logger.warning("Fundamentals fetch failed for %s: %s", ticker, exc)
            snap = None
        if snap is not None:
            for field in _SNAPSHOT_FIELDS:
                if getattr(request, field, None) is None:
                    value = getattr(snap, field, None)
                    if value is not None:
                        updates[field] = value

    if earnings is not None and request.days_to_earnings is None:
        try:
            days, date = earnings(ticker)
        except Exception as exc:
            logger.warning("Earnings fetch failed for %s: %s", ticker, exc)
            days, date = None, None
        if days is not None:
            updates["days_to_earnings"] = days
        if date is not None and request.next_earnings_date is None:
            updates["next_earnings_date"] = date

    if not updates:
        return request
    return request.model_copy(update=updates)
