"""DeGiro capability audit — probes available data endpoints per symbol.

All degiro_connector imports are lazy.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from swing_screener.integrations.degiro.models import (
    DegiroAuditRecord,
    DegiroAuditRun,
    DegiroProductRef,
)
from swing_screener.integrations.degiro.resolver import resolve_symbol

logger = logging.getLogger(__name__)


def _probe_quote(api: Any, product_ref: DegiroProductRef) -> bool:
    try:
        from degiro_connector.quotecast.api import API as QuotecastAPI  # noqa: F401
    except ImportError:
        return False
    try:
        response = api.get_price_info(product_ref.vwd_id or product_ref.product_id)
        return response is not None
    except Exception:
        return False


def _probe_company_profile(api: Any, product_id: str) -> bool:
    try:
        response = api.get_company_profile(product_id)
        return bool(response)
    except Exception:
        return False


def _probe_financial_statements(api: Any, isin: str | None) -> bool:
    if not isin:
        return False
    try:
        response = api.get_financial_statements(isin)
        return bool(response)
    except Exception:
        return False


def _probe_analyst_views(api: Any, isin: str | None) -> bool:
    if not isin:
        return False
    try:
        response = api.get_analyst_views(isin)
        return bool(response)
    except Exception:
        return False


def _probe_news(api: Any, isin: str | None) -> bool:
    if not isin:
        return False
    try:
        response = api.get_news_by_company(isin, limit=1)
        return bool(response)
    except Exception:
        return False


def _probe_agenda(api: Any, isin: str | None) -> bool:
    if not isin:
        return False
    try:
        response = api.get_agenda(isin)
        return bool(response)
    except Exception:
        return False


def _audit_symbol(
    client: Any,
    symbol: str,
    *,
    include_quotes: bool,
    include_news: bool,
    include_agenda: bool,
) -> DegiroAuditRecord:
    """Resolve one symbol and probe its available endpoints."""
    product_ref, confidence, notes = resolve_symbol(client, symbol)

    if product_ref is None:
        return DegiroAuditRecord(
            product_id="",
            isin=None,
            vwd_id=None,
            name=symbol,
            exchange=None,
            currency=None,
            symbol=symbol,
            resolution_confidence=confidence,
            resolution_notes=notes,
        )

    api = client.api

    has_quote = _probe_quote(api, product_ref) if include_quotes else False
    has_chart = False  # chart endpoint not standardised in degiro-connector; skip
    has_profile = _probe_company_profile(api, product_ref.product_id)
    has_ratios = False  # ratio endpoint is undocumented; leave False
    has_statements = _probe_financial_statements(api, product_ref.isin)
    has_estimates = _probe_analyst_views(api, product_ref.isin)
    has_agenda = _probe_agenda(api, product_ref.isin) if include_agenda else False
    has_news = _probe_news(api, product_ref.isin) if include_news else False

    return DegiroAuditRecord(
        product_id=product_ref.product_id,
        isin=product_ref.isin,
        vwd_id=product_ref.vwd_id,
        name=product_ref.name,
        exchange=product_ref.exchange,
        currency=product_ref.currency,
        symbol=product_ref.symbol or symbol,
        has_quote=has_quote,
        has_chart=has_chart,
        has_profile=has_profile,
        has_ratios=has_ratios,
        has_statements=has_statements,
        has_estimates=has_estimates,
        has_agenda=has_agenda,
        has_news=has_news,
        resolution_confidence=confidence,
        resolution_notes=notes,
    )


def run_capability_audit(
    client: Any,
    symbols: list[str],
    *,
    include_quotes: bool = True,
    include_news: bool = True,
    include_agenda: bool = True,
) -> DegiroAuditRun:
    """Audit DeGiro data availability for each symbol in *symbols*.

    Returns a DegiroAuditRun with per-symbol records and summary counts.
    """
    audit_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    results: list[DegiroAuditRecord] = []
    for symbol in symbols:
        logger.info("Auditing %s ...", symbol)
        record = _audit_symbol(
            client,
            symbol,
            include_quotes=include_quotes,
            include_news=include_news,
            include_agenda=include_agenda,
        )
        results.append(record)

    # Summary counts by resolution_confidence
    confidence_counts: dict[str, int] = {}
    for r in results:
        confidence_counts[r.resolution_confidence] = (
            confidence_counts.get(r.resolution_confidence, 0) + 1
        )

    coverage_fields = (
        "has_quote", "has_chart", "has_profile", "has_ratios",
        "has_statements", "has_estimates", "has_agenda", "has_news",
    )
    coverage_counts = {f: sum(1 for r in results if getattr(r, f)) for f in coverage_fields}

    summary_counts = {**confidence_counts, **coverage_counts, "total": len(results)}

    return DegiroAuditRun(
        audit_id=audit_id,
        created_at=created_at,
        symbols=tuple(symbols),
        results=tuple(results),
        summary_counts=summary_counts,
    )
