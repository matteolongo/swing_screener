from __future__ import annotations

from functools import lru_cache


# Common Yahoo Finance ticker suffixes for EUR-traded venues.
EUR_SUFFIXES = frozenset(
    {
        "AS",  # Euronext Amsterdam
        "BR",  # Euronext Brussels
        "PA",  # Euronext Paris
        "DE",  # XETRA / Deutsche Boerse
        "MI",  # Borsa Italiana
        "MC",  # Bolsa de Madrid
        "LS",  # Euronext Lisbon
        "IR",  # Euronext Dublin
        "HE",  # Nasdaq Helsinki
        "ST",  # Nasdaq Stockholm
        "CO",  # Nasdaq Copenhagen
        "OL",  # Oslo Bors
        "VI",  # Wiener Borse
    }
)


@lru_cache(maxsize=4096)
def detect_currency(ticker: str) -> str:
    """
    Detect currency from ticker suffix.

    Rules:
    - known EUR suffixes (e.g. .AS, .DE) -> EUR
    - otherwise -> USD
    """
    if not ticker:
        return "USD"

    symbol = str(ticker).strip().upper()
    if "." not in symbol:
        return "USD"

    suffix = symbol.rsplit(".", 1)[-1]
    if suffix in EUR_SUFFIXES:
        return "EUR"
    return "USD"
