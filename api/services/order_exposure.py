"""Canonical account-currency exposure normalization."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Literal, Mapping, Sequence

from swing_screener.data.currency import detect_currency


class ExposureContextError(ValueError):
    """Raised when an exposure cannot be normalized safely."""


def _decimal(value: object, field: str) -> Decimal:
    if isinstance(value, bool) or value is None:
        raise ExposureContextError(f"{field} is invalid")
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ExposureContextError(f"{field} is invalid") from exc
    if not number.is_finite():
        raise ExposureContextError(f"{field} is invalid")
    return number


def quote_to_account(
    amount: Decimal,
    account_currency: str,
    quote_currency: str,
    rate: Decimal | None,
) -> Decimal:
    account = account_currency.upper()
    quote = quote_currency.upper()
    if account == quote:
        return amount
    if rate is None or not rate.is_finite() or rate <= 0:
        raise ExposureContextError(
            f"FX_CONTEXT_MISSING: {quote}/{account} exposure has no positive persisted rate"
        )
    return amount / rate


def country_from_ticker(ticker: str) -> str:
    suffix = ticker.upper().rsplit(".", 1)[-1] if "." in ticker else "US"
    return {
        "AS": "NL",
        "DE": "DE",
        "PA": "FR",
        "MI": "IT",
        "MC": "ES",
        "L": "UK",
        "SW": "CH",
        "ST": "SE",
        "CO": "DK",
        "OL": "NO",
        "BR": "BE",
        "LS": "PT",
        "HE": "FI",
    }.get(suffix, "US")


@dataclass(frozen=True)
class ProposedExposure:
    ticker: str
    quantity: int
    entry: Decimal
    stop: Decimal
    account_currency: str
    quote_currency: str
    account_to_quote_rate: Decimal


@dataclass(frozen=True)
class ExposureLine:
    ticker: str
    country: str
    source: Literal["position", "pending", "proposed"]
    notional_account: Decimal
    price_risk_account: Decimal


@dataclass(frozen=True)
class ExposureSnapshot:
    lines: tuple[ExposureLine, ...]
    current_notional: Decimal
    current_risk: Decimal
    projected_notional: Decimal
    projected_price_risk: Decimal


def _quote_currency(row: Mapping[str, object], ticker: str) -> str:
    value = row.get("quote_currency") or row.get("currency")
    if value:
        return str(value).upper()
    return str(detect_currency(ticker) or "UNKNOWN").upper()


def _line(
    row: Mapping[str, object],
    source: Literal["position", "pending"],
    account_currency: str,
) -> ExposureLine:
    ticker = str(row.get("ticker") or "").upper()
    persisted_account = str(row.get("account_currency") or "").upper()
    if persisted_account and persisted_account != account_currency.upper():
        raise ExposureContextError(
            "ACCOUNT_CURRENCY_MISMATCH: "
            f"{ticker} was approved in {persisted_account}, not {account_currency.upper()}"
        )
    quantity_field = "shares" if source == "position" else "quantity"
    entry_field = "entry_price" if source == "position" else "limit_price"
    quantity = _decimal(row.get(quantity_field), quantity_field)
    entry = _decimal(row.get(entry_field), entry_field)
    stop = _decimal(row.get("stop_price"), "stop_price")
    quote_currency = _quote_currency(row, ticker)
    rate_value = (
        row.get("entry_fx_rate")
        if source == "position"
        else row.get("account_to_quote_rate")
    )
    if rate_value is None:
        rate_value = row.get("approval_fx_rate")
    rate = (
        _decimal(rate_value, "account_to_quote_rate")
        if rate_value is not None
        else None
    )
    return ExposureLine(
        ticker=ticker,
        country=country_from_ticker(ticker),
        source=source,
        notional_account=quote_to_account(
            quantity * entry, account_currency, quote_currency, rate
        ),
        price_risk_account=quote_to_account(
            quantity * max(Decimal("0"), entry - stop),
            account_currency,
            quote_currency,
            rate,
        ),
    )


def build_exposure_snapshot(
    positions: Sequence[Mapping[str, object]],
    orders: Sequence[Mapping[str, object]],
    proposed: ProposedExposure,
) -> ExposureSnapshot:
    lines: list[ExposureLine] = []
    for position in positions:
        if position.get("status") == "open":
            lines.append(_line(position, "position", proposed.account_currency))
    for order in orders:
        if (
            order.get("status") in {"pending", "submitted"}
            and order.get("order_kind") == "entry"
        ):
            lines.append(_line(order, "pending", proposed.account_currency))
    proposed_line = ExposureLine(
        ticker=proposed.ticker.upper(),
        country=country_from_ticker(proposed.ticker),
        source="proposed",
        notional_account=quote_to_account(
            Decimal(proposed.quantity) * proposed.entry,
            proposed.account_currency,
            proposed.quote_currency,
            proposed.account_to_quote_rate,
        ),
        price_risk_account=quote_to_account(
            Decimal(proposed.quantity)
            * max(Decimal("0"), proposed.entry - proposed.stop),
            proposed.account_currency,
            proposed.quote_currency,
            proposed.account_to_quote_rate,
        ),
    )
    current_notional = sum((line.notional_account for line in lines), Decimal("0"))
    current_risk = sum((line.price_risk_account for line in lines), Decimal("0"))
    lines.append(proposed_line)
    return ExposureSnapshot(
        lines=tuple(lines),
        current_notional=current_notional,
        current_risk=current_risk,
        projected_notional=current_notional + proposed_line.notional_account,
        projected_price_risk=current_risk + proposed_line.price_risk_account,
    )
