"""Deterministic FX resolution for screener account-currency conversion."""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Literal, Mapping

from swing_screener.data.currencies import get_currency_definition


@dataclass(frozen=True)
class FxConversionResult:
    status: Literal["available", "unavailable"]
    account_currency: str
    quote_currency: str
    rate: float | None = None
    pair: str | None = None
    reason: str | None = None


def _valid_rate(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        rate = float(value)
    except (TypeError, ValueError):
        return None
    return rate if math.isfinite(rate) and rate > 0 else None


def resolve_fx_conversion(
    account_currency: str,
    quote_currency: str,
    rates: Mapping[str, object],
) -> FxConversionResult:
    """Resolve account-to-quote conversion via direct pair, then inverse pair."""

    account = get_currency_definition(account_currency).code
    quote = get_currency_definition(quote_currency).code
    if account == quote:
        return FxConversionResult("available", account, quote, 1.0)

    direct_pair = f"{account}{quote}=X"
    direct = _valid_rate(rates.get(direct_pair))
    if direct is not None:
        return FxConversionResult("available", account, quote, direct, direct_pair)

    inverse_pair = f"{quote}{account}=X"
    inverse = _valid_rate(rates.get(inverse_pair))
    if inverse is not None:
        return FxConversionResult(
            "available", account, quote, 1.0 / inverse, inverse_pair
        )

    return FxConversionResult(
        "unavailable",
        account,
        quote,
        reason="fx_rate_unavailable",
    )
