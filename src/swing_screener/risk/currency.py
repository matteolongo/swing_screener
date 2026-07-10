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
