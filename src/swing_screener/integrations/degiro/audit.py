"""DeGiro capability audit — probes available data endpoints per symbol.

All degiro_connector imports are lazy.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from swing_screener.integrations.degiro.models import (
    DegiroAuditRecord,
    DegiroAuditRun,
    DegiroProductRef,
)
from swing_screener.integrations.degiro.resolver import resolve_by_product_id, resolve_symbol

logger = logging.getLogger(__name__)


def _probe_quote(api: Any, vwd_id: Optional[str]) -> bool:
    """Quote data requires the quotecast module — mark as available if vwd_id exists."""
    return bool(vwd_id)


def _probe_company_profile(api: Any, isin: Optional[str]) -> bool:
    if not isin:
        return False
    try:
        response = api.get_company_profile(product_isin=isin)
        return bool(response)
    except Exception:
        return False


def _probe_company_ratios(api: Any, isin: Optional[str]) -> bool:
    if not isin:
        return False
    try:
        response = api.get_company_ratios(product_isin=isin)
        return bool(response)
    except Exception:
        return False


def _probe_financial_statements(api: Any, isin: Optional[str]) -> bool:
    if not isin:
        return False
    try:
        response = api.get_financials_statements(product_isin=isin)
        return bool(response)
    except Exception:
        return False


def _probe_estimates(api: Any, isin: Optional[str]) -> bool:
    if not isin:
        return False
    try:
        response = api.get_estimates_summaries(product_isin=isin, raw=True)
        return bool(response)
    except Exception:
        return False


def _probe_news(api: Any, isin: Optional[str]) -> bool:
    if not isin:
        return False
    try:
        from degiro_connector.trading.models.news import NewsByCompany
        request = NewsByCompany.Request(isin=isin, limit=1, offset=0, languages="en")
        response = api.get_news_by_company(request=request, raw=True)
        return bool(response)
    except Exception:
        return False


def _probe_agenda(api: Any, isin: Optional[str]) -> bool:
    if not isin:
        return False
    try:
        from datetime import timedelta
        from degiro_connector.trading.models.agenda import AgendaRequest, CalendarType
        from google.protobuf.timestamp_pb2 import Timestamp
        now = datetime.now(timezone.utc)
        start = Timestamp()
        start.FromDatetime(now - timedelta(days=180))
        end = Timestamp()
        end.FromDatetime(now + timedelta(days=180))
        request = AgendaRequest(
            calendar_type=CalendarType.EARNINGS_CALENDAR,
            start_date=start,
            end_date=end,
            isin=isin,
            offset=0,
            limit=5,
        )
        response = api.get_agenda(agenda_request=request, raw=True)
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
    isin = product_ref.isin

    has_quote = _probe_quote(api, product_ref.vwd_id) if include_quotes else False
    has_chart = has_quote  # chart uses same vwd_id
    has_profile = _probe_company_profile(api, isin)
    has_ratios = _probe_company_ratios(api, isin)
    has_statements = _probe_financial_statements(api, isin)
    has_estimates = _probe_estimates(api, isin)
    has_agenda = _probe_agenda(api, isin) if include_agenda else False
    has_news = _probe_news(api, isin) if include_news else False

    return DegiroAuditRecord(
        product_id=product_ref.product_id,
        isin=isin,
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


def _audit_product_id(
    client: Any,
    product_id: str,
    *,
    include_quotes: bool,
    include_news: bool,
    include_agenda: bool,
) -> DegiroAuditRecord:
    """Audit a known DeGiro product ID (uses get_products_info instead of text search)."""
    from swing_screener.integrations.degiro.resolver import resolve_by_product_id

    product_ref, confidence, notes = resolve_by_product_id(client, product_id)

    if product_ref is None:
        return DegiroAuditRecord(
            product_id=product_id,
            isin=None,
            vwd_id=None,
            name=product_id,
            exchange=None,
            currency=None,
            symbol=product_id,
            resolution_confidence=confidence,
            resolution_notes=notes,
        )

    api = client.api
    isin = product_ref.isin

    has_quote = _probe_quote(api, product_ref.vwd_id) if include_quotes else False
    has_chart = has_quote
    has_profile = _probe_company_profile(api, isin)
    has_ratios = _probe_company_ratios(api, isin)
    has_statements = _probe_financial_statements(api, isin)
    has_estimates = _probe_estimates(api, isin)
    has_agenda = _probe_agenda(api, isin) if include_agenda else False
    has_news = _probe_news(api, isin) if include_news else False

    return DegiroAuditRecord(
        product_id=product_ref.product_id,
        isin=isin,
        vwd_id=product_ref.vwd_id,
        name=product_ref.name,
        exchange=product_ref.exchange,
        currency=product_ref.currency,
        symbol=product_ref.symbol or product_id,
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


def run_portfolio_capability_audit(
    client: Any,
    *,
    include_quotes: bool = True,
    include_news: bool = True,
    include_agenda: bool = True,
) -> DegiroAuditRun:
    """Audit all products currently held in the DeGiro portfolio.

    Fetches live portfolio positions, extracts product IDs, then probes each
    product's data capabilities via get_products_info + ISIN-based endpoints.
    This works even when the text-search (LookupRequest) endpoint is unavailable.
    """
    try:
        from degiro_connector.trading.models.account import UpdateOption, UpdateRequest
    except ImportError as exc:
        raise ImportError(
            "degiro-connector is not installed. Install with: pip install -e '.[degiro]'"
        ) from exc

    api = client.api
    update = api.get_update(
        request_list=[UpdateRequest(option=UpdateOption.PORTFOLIO, last_updated=0)],
        raw=True,
    ) or {}
    portfolio_items = update.get("portfolio", {}).get("value", [])

    product_ids: list[str] = []
    for item in portfolio_items:
        vals = {v["name"]: v["value"] for v in item.get("value", []) if "value" in v}
        pid = str(vals.get("id", "") or item.get("id", "")).strip()
        pos_type = vals.get("positionType", "")
        if pid and pos_type != "CASH":
            product_ids.append(pid)

    audit_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    results: list[DegiroAuditRecord] = []

    for pid in product_ids:
        logger.info("Auditing product_id=%s ...", pid)
        record = _audit_product_id(
            client,
            pid,
            include_quotes=include_quotes,
            include_news=include_news,
            include_agenda=include_agenda,
        )
        results.append(record)
        logger.info(
            "  %s (%s) → isin=%s profile=%s statements=%s news=%s",
            record.name, pid, record.isin,
            record.has_profile, record.has_statements, record.has_news,
        )

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
        symbols=tuple(pid for pid in product_ids),
        results=tuple(results),
        summary_counts=summary_counts,
    )


def run_capability_audit(
    client: Any,
    symbols: list[str],
    *,
    include_quotes: bool = True,
    include_news: bool = True,
    include_agenda: bool = True,
) -> DegiroAuditRun:
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
        logger.info(
            "  %s → confidence=%s profile=%s statements=%s news=%s",
            symbol, record.resolution_confidence,
            record.has_profile, record.has_statements, record.has_news,
        )

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
