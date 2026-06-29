"""Reconcile DeGiro live portfolio against local positions.json.

Fetches the live portfolio from DeGiro and compares it against registered
open positions. Returns holdings that are present in DeGiro but not yet
registered locally — the user still sets stop_price and creates them via
the existing POST /positions endpoint.

Side-effect: updates data/degiro/isin_map.json so the fundamentals provider
resolves ISIN for all held tickers.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class DeGiroHolding(BaseModel):
    """One live holding from DeGiro's portfolio endpoint."""

    product_id: str
    isin: str | None = None
    ticker: str | None = None
    name: str | None = None
    quantity: int
    avg_cost: float | None = None
    currency: str | None = None


class DeGiroSyncResult(BaseModel):
    synced_at: str
    holdings: list[DeGiroHolding]
    unregistered: list[DeGiroHolding]
    isin_map_updated: bool
    error: str | None = None


def _get_client() -> Any | None:
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
        return client
    except Exception as exc:
        logger.error("degiro_sync: connect failed: %s", exc)
        return None


def _fetch_holdings(api: Any) -> list[DeGiroHolding]:
    from degiro_connector.trading.models.account import UpdateOption, UpdateRequest

    update = api.get_update(
        request_list=[UpdateRequest(option=UpdateOption.PORTFOLIO, last_updated=0)],
        raw=True,
    )
    if not update:
        return []

    portfolio_items = update.get("portfolio", {}).get("value", [])
    holdings: list[DeGiroHolding] = []

    for item in portfolio_items:
        value_map = {v["name"]: v.get("value") for v in item.get("value", [])}
        product_id = str(value_map.get("id", ""))
        qty = value_map.get("size", 0)
        if not product_id or not qty or float(qty) == 0:
            continue

        position_type = value_map.get("positionType")
        if position_type != "PRODUCT":
            continue

        avg_cost_raw = value_map.get("averageFxRate") or value_map.get("breakEvenPrice")
        holdings.append(
            DeGiroHolding(
                product_id=product_id,
                quantity=int(float(qty)),
                avg_cost=float(avg_cost_raw) if avg_cost_raw is not None else None,
                currency=value_map.get("currency"),
            )
        )

    return holdings


def _enrich_holdings_with_product_info(api: Any, holdings: list[DeGiroHolding]) -> list[DeGiroHolding]:
    if not holdings:
        return holdings

    product_ids = [h.product_id for h in holdings]
    try:
        info = api.get_products_info(product_list=product_ids, raw=True) or {}
    except Exception as exc:
        logger.warning("degiro_sync: get_products_info failed: %s", exc)
        return holdings

    product_data = info.get("data", {}) or {}
    enriched: list[DeGiroHolding] = []
    for h in holdings:
        prod = product_data.get(h.product_id) or {}
        enriched.append(
            h.model_copy(update={
                "isin": prod.get("isin") or h.isin,
                "ticker": prod.get("symbol") or h.ticker,
                "name": prod.get("name") or h.name,
                "currency": prod.get("currency") or h.currency,
            })
        )

    return enriched


def _existing_tickers(positions_repo: Any) -> set[str]:
    try:
        data = positions_repo.read()
        return {
            p["ticker"].upper()
            for p in data.get("positions", [])
            if p.get("status") == "open"
        }
    except Exception:
        return set()


def sync_degiro_holdings(positions_repo: Any) -> DeGiroSyncResult:
    from datetime import datetime, timezone

    synced_at = datetime.now(tz=timezone.utc).isoformat()

    client = _get_client()
    if client is None:
        return DeGiroSyncResult(
            synced_at=synced_at,
            holdings=[],
            unregistered=[],
            isin_map_updated=False,
            error="DeGiro credentials not configured (DEGIRO_USERNAME / DEGIRO_PASSWORD)",
        )

    try:
        holdings = _fetch_holdings(client.api)
        holdings = _enrich_holdings_with_product_info(client.api, holdings)
    except Exception as exc:
        logger.error("degiro_sync: fetch failed: %s", exc)
        return DeGiroSyncResult(
            synced_at=synced_at,
            holdings=[],
            unregistered=[],
            isin_map_updated=False,
            error=str(exc),
        )
    finally:
        client.disconnect()

    # Update ISIN map as a side-effect
    isin_map_updated = False
    try:
        from swing_screener.fundamentals.providers.degiro import update_isin_map_from_audit
        audit_records = [
            {"symbol": h.ticker, "isin": h.isin}
            for h in holdings
            if h.ticker and h.isin
        ]
        if audit_records:
            update_isin_map_from_audit(audit_records)
            isin_map_updated = True
    except Exception as exc:
        logger.warning("degiro_sync: ISIN map update failed: %s", exc)

    existing = _existing_tickers(positions_repo)
    unregistered = [
        h for h in holdings
        if h.ticker and h.ticker.upper() not in existing
    ]

    return DeGiroSyncResult(
        synced_at=synced_at,
        holdings=holdings,
        unregistered=unregistered,
        isin_map_updated=isin_map_updated,
    )
