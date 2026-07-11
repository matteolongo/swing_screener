"""Shared currency/FX normalization helpers for risk sizing and recommendations.

These are the single source of truth for the two normalizations that used to be
copy-pasted across ``risk/position_sizing.py``, ``risk/recommendations/engine.py``
and ``api/services/same_symbol_reentry.py``.
"""

from __future__ import annotations

import math
from typing import Optional


def normalize_account_to_quote_rate(value: float) -> float:
    """Return a positive, finite account-to-quote FX rate or raise ``ValueError``."""
    rate = float(value)
    if not math.isfinite(rate) or rate <= 0:
        raise ValueError("account_to_quote_rate must be a positive finite number")
    return rate


def normalize_currency_code(value: object) -> Optional[str]:
    """Upper-case, stripped currency code; ``None`` when blank/missing."""
    normalized = str(value or "").strip().upper()
    return normalized or None


def convert_via_eurusd(
    amount: float, from_currency: object, to_currency: object, eurusd_rate: float
) -> tuple[float, bool]:
    """Convert ``amount`` between EUR and USD using EURUSD (USD per 1 EUR).

    Returns ``(converted_amount, converted_ok)``. ``converted_ok`` is ``False``
    (and the amount is returned unchanged) when the rate is non-positive or the
    currency pair is not one this system can convert. Same-currency conversion is
    always ok. This is the single place the EUR/USD pair math lives; support for
    additional pairs is a future extension point here, not per-call-site branches.
    """
    src = normalize_currency_code(from_currency)
    dst = normalize_currency_code(to_currency)
    if src == dst:
        return amount, True
    if eurusd_rate <= 0:
        return amount, False
    if src == "USD" and dst == "EUR":
        return amount / eurusd_rate, True
    if src == "EUR" and dst == "USD":
        return amount * eurusd_rate, True
    return amount, False
