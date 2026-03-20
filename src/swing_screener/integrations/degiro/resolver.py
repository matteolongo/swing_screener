"""Symbol resolver: map a ticker string to a DegiroProductRef.

Resolution priority (highest → lowest confidence):
  1. exact ticker / alias match from search results
  2. exchange + currency agreement
  3. ambiguous (multiple equally plausible hits)
  4. not_found

All degiro_connector imports are lazy.
"""
from __future__ import annotations

import logging
from typing import Optional

from swing_screener.integrations.degiro.models import DegiroProductRef

logger = logging.getLogger(__name__)


def _extract_product_ref(hit: dict) -> DegiroProductRef:
    return DegiroProductRef(
        product_id=str(hit.get("id", "")),
        isin=hit.get("isin") or None,
        vwd_id=str(hit.get("vwdId", "")) or None,
        name=str(hit.get("name", "")),
        exchange=hit.get("exchangeId") or hit.get("exchange") or None,
        currency=hit.get("currency") or None,
        symbol=hit.get("symbol") or hit.get("contractSize") or None,
    )


def resolve_symbol(
    client: object,
    symbol: str,
    *,
    preferred_exchange: Optional[str] = None,
    preferred_currency: Optional[str] = None,
) -> tuple[Optional[DegiroProductRef], str, str]:
    """Resolve *symbol* to a DeGiro product reference.

    Returns:
        (product_ref, confidence, notes)
        confidence ∈ {"exact", "alias", "exchange", "ambiguous", "not_found"}
    """
    try:
        from degiro_connector.trading.models.product_search import (
            ProductSearch,
            TextProductSearch,
        )
    except ImportError as exc:
        raise ImportError(
            "degiro-connector is not installed. Install with: pip install -e '.[degiro]'"
        ) from exc

    upper = symbol.strip().upper()

    # Fetch search hits
    try:
        request = TextProductSearch(search_text=upper, limit=10)
        response = client.api.get_products_by_id(request)  # type: ignore[attr-defined]
        raw_hits: list[dict] = []
        if response and hasattr(response, "products"):
            raw_hits = list(response.products) if response.products else []
        elif isinstance(response, dict):
            raw_hits = response.get("products", [])
    except Exception:
        logger.warning("DeGiro product search failed for %s", upper, exc_info=True)
        return None, "not_found", "Search API error"

    if not raw_hits:
        return None, "not_found", f"No products returned for {upper!r}"

    logger.debug("DeGiro search for %r returned %d hit(s)", upper, len(raw_hits))

    # --- Pass 1: exact symbol match ---
    exact: list[dict] = []
    for hit in raw_hits:
        hit_symbol = str(hit.get("symbol", "")).upper()
        if hit_symbol == upper:
            exact.append(hit)

    if len(exact) == 1:
        ref = _extract_product_ref(exact[0])
        return ref, "exact", f"Exact symbol match for {upper!r}"

    # --- Pass 2: exchange + currency filter ---
    candidates = exact if exact else raw_hits
    filtered: list[dict] = []
    for hit in candidates:
        exchange_ok = (
            preferred_exchange is None
            or str(hit.get("exchangeId", "")).upper() == preferred_exchange.upper()
        )
        currency_ok = (
            preferred_currency is None
            or str(hit.get("currency", "")).upper() == preferred_currency.upper()
        )
        if exchange_ok and currency_ok:
            filtered.append(hit)

    if len(filtered) == 1:
        confidence = "alias" if exact else "exchange"
        ref = _extract_product_ref(filtered[0])
        return ref, confidence, f"Exchange/currency filter narrowed to 1 result for {upper!r}"

    # --- Ambiguous ---
    pool = filtered if filtered else candidates
    if len(pool) > 1:
        names = [h.get("name", "?") for h in pool[:5]]
        notes = f"Ambiguous: {len(pool)} candidates for {upper!r}: {names}"
        logger.info(notes)
        return None, "ambiguous", notes

    # --- Single fallback hit ---
    ref = _extract_product_ref(pool[0])
    return ref, "alias", f"Single fallback result for {upper!r}"
