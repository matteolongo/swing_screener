"""Fetch upcoming dividend events from DeGiro's agenda for held positions.

Provides days_to_dividend, next_dividend_date, and next_dividend_amount for
an ISIN so the intelligence prompt can note ex-date proximity. Particularly
useful for EU equities where free dividend calendar data is sparse.

Returns None when credentials are absent, ISIN is unknown, or no upcoming
dividend is found in the next 90 days.
"""
from __future__ import annotations

import logging
from datetime import datetime, date, timedelta, timezone
from typing import Any

from pydantic import BaseModel

logger = logging.getLogger(__name__)

_LOOKAHEAD_DAYS = 90


class DividendProximity(BaseModel):
    isin: str
    ex_date: str
    days_until: int
    amount: float | None = None
    currency: str | None = None


def get_dividend_proximity(isin: str, *, asof: date | None = None) -> DividendProximity | None:
    """Return the nearest upcoming dividend for an ISIN, or None."""
    asof = asof or date.today()

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

    client: Any = None
    try:
        client = DegiroClient(load_credentials())
        client.connect()

        from degiro_connector.trading.models.agenda import AgendaRequest, CalendarType

        start_dt = datetime.combine(asof, datetime.min.time(), tzinfo=timezone.utc)
        end_dt = datetime.combine(asof + timedelta(days=_LOOKAHEAD_DAYS), datetime.min.time(), tzinfo=timezone.utc)

        agenda_req = AgendaRequest(
            calendarType=CalendarType.DIVIDEND_CALENDAR,
            isin=isin,
            startDate=start_dt,
            endDate=end_dt,
            limit=5,
        )

        result = client.api.get_agenda(agenda_request=agenda_req, raw=True)
    except Exception as exc:
        logger.warning("degiro_dividend: agenda fetch failed for %s: %s", isin, exc)
        return None
    finally:
        if client is not None:
            client.disconnect()

    if not result:
        return None

    items = (result.get("data") or {}).get("items") or []
    if not items:
        return None

    # Items are sorted by date asc by default (sortColumn='date', sortType='asc')
    nearest = items[0]
    raw_date = nearest.get("date") or nearest.get("exDate") or nearest.get("paymentDate")
    if not raw_date:
        return None

    try:
        ex_date = date.fromisoformat(str(raw_date)[:10])
    except ValueError:
        return None

    days_until = (ex_date - asof).days
    if days_until < 0:
        return None

    amount_raw = nearest.get("amount") or nearest.get("dividend")
    amount = float(amount_raw) if amount_raw is not None else None

    return DividendProximity(
        isin=isin,
        ex_date=ex_date.isoformat(),
        days_until=days_until,
        amount=amount,
        currency=nearest.get("currency"),
    )
