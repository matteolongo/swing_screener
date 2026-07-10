"""Shared currency/FX normalization helpers."""

import pytest

from swing_screener.risk.currency import (
    normalize_account_to_quote_rate,
    normalize_currency_code,
)


def test_normalize_account_to_quote_rate_accepts_positive_finite():
    assert normalize_account_to_quote_rate(1.08) == 1.08


@pytest.mark.parametrize("bad", [0.0, -1.0, float("nan"), float("inf")])
def test_normalize_account_to_quote_rate_rejects_invalid(bad):
    with pytest.raises(ValueError, match="positive finite"):
        normalize_account_to_quote_rate(bad)


def test_normalize_currency_code():
    assert normalize_currency_code(" usd ") == "USD"
    assert normalize_currency_code("") is None
    assert normalize_currency_code(None) is None
