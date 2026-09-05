"""Canonical supported-currency and market-session registry."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import time


@dataclass(frozen=True)
class CurrencyDefinition:
    code: str
    timezone: str
    close_time: time


_CURRENCIES = {
    "USD": CurrencyDefinition("USD", "America/New_York", time(16, 10)),
    "EUR": CurrencyDefinition("EUR", "Europe/Amsterdam", time(17, 40)),
    "GBP": CurrencyDefinition("GBP", "Europe/London", time(16, 40)),
    "CHF": CurrencyDefinition("CHF", "Europe/Zurich", time(17, 40)),
    "SEK": CurrencyDefinition("SEK", "Europe/Stockholm", time(17, 40)),
    "DKK": CurrencyDefinition("DKK", "Europe/Copenhagen", time(17, 10)),
    "NOK": CurrencyDefinition("NOK", "Europe/Oslo", time(16, 30)),
}


def supported_currency_codes() -> tuple[str, ...]:
    """Return supported ISO currency codes in stable order."""

    return tuple(sorted(_CURRENCIES))


def get_currency_definition(code: str) -> CurrencyDefinition:
    """Return canonical currency metadata or reject an unsupported code."""

    normalized = str(code).strip().upper()
    try:
        return _CURRENCIES[normalized]
    except KeyError as exc:
        raise ValueError(f"Unsupported currency code: {normalized}") from exc
