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


def test_convert_via_eurusd_same_currency_is_identity():
    from swing_screener.risk.currency import convert_via_eurusd

    assert convert_via_eurusd(100.0, "USD", "USD", 1.08) == (100.0, True)
    assert convert_via_eurusd(100.0, "eur", "EUR", 1.08) == (100.0, True)


def test_convert_via_eurusd_usd_eur_pair():
    from swing_screener.risk.currency import convert_via_eurusd

    usd_to_eur, ok1 = convert_via_eurusd(108.0, "USD", "EUR", 1.08)
    eur_to_usd, ok2 = convert_via_eurusd(100.0, "EUR", "USD", 1.08)
    assert ok1 and round(usd_to_eur, 2) == 100.0
    assert ok2 and round(eur_to_usd, 2) == 108.0


def test_convert_via_eurusd_rejects_bad_rate_and_unsupported_pair():
    from swing_screener.risk.currency import convert_via_eurusd

    assert convert_via_eurusd(100.0, "USD", "EUR", 0.0) == (100.0, False)
    assert convert_via_eurusd(100.0, "GBP", "EUR", 1.08) == (100.0, False)
