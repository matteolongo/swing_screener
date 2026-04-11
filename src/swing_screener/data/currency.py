from __future__ import annotations

import json
import os
from functools import lru_cache


# Suffix → currency map covering all supported trading currencies.
_SUFFIX_CURRENCY: dict[str, str] = {
    # EUR venues
    "AS": "EUR",   # Euronext Amsterdam
    "BR": "EUR",   # Euronext Brussels
    "PA": "EUR",   # Euronext Paris
    "DE": "EUR",   # XETRA
    "MI": "EUR",   # Borsa Italiana
    "MC": "EUR",   # Bolsa de Madrid
    "LS": "EUR",   # Euronext Lisbon
    "IR": "EUR",   # Euronext Dublin
    "HE": "EUR",   # Nasdaq Helsinki
    "VI": "EUR",   # Wiener Borse
    # Non-EUR European venues
    "ST": "SEK",   # Nasdaq Stockholm
    "CO": "DKK",   # Nasdaq Copenhagen
    "OL": "NOK",   # Oslo Bors
    "SW": "CHF",   # SIX Swiss Exchange
    "L": "GBP",    # London Stock Exchange
}

# Supported packaged-universe trading currencies.
SUPPORTED_CURRENCIES = frozenset({"USD", "EUR", "GBP", "CHF", "SEK", "DKK", "NOK"})


@lru_cache(maxsize=1)
def _load_instrument_master_currencies() -> dict[str, str]:
    """Return symbol → currency from instrument_master.json, cached."""
    for candidate in [
        "data/intelligence/instrument_master.json",
        os.path.join(
            os.path.dirname(__file__),
            "..", "..", "..", "..", "data", "intelligence", "instrument_master.json",
        ),
    ]:
        p = os.path.abspath(candidate)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                records = json.load(f)
            return {r["symbol"]: r["currency"] for r in records if r.get("currency")}
    return {}


@lru_cache(maxsize=4096)
def detect_currency(ticker: str) -> str:
    """
    Detect trading currency for a ticker.

    Resolution precedence:
    1. Instrument master lookup (authoritative)
    2. Suffix map (controlled, covers EUR/GBP/CHF/SEK/DKK/NOK)
    3. Returns "UNKNOWN" — never coerces to USD or EUR

    Only no-suffix tickers that are explicitly in the instrument master as USD
    will resolve to USD. Tickers with no suffix and no instrument master entry
    return "UNKNOWN" to avoid silent misclassification.
    """
    if not ticker:
        return "UNKNOWN"

    symbol = str(ticker).strip().upper()

    # 1. Instrument master (highest precedence)
    master = _load_instrument_master_currencies()
    if master and symbol in master:
        currency = master[symbol]
        return currency if currency else "UNKNOWN"

    # 2. Suffix map
    if "." in symbol:
        suffix = symbol.rsplit(".", 1)[-1]
        if suffix in _SUFFIX_CURRENCY:
            return _SUFFIX_CURRENCY[suffix]

    # 3. Unknown — cannot determine without instrument master entry
    return "UNKNOWN"
