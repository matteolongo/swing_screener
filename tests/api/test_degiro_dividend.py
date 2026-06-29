"""Tests for _parse_nearest_dividend in degiro_dividend."""
from __future__ import annotations

from datetime import date

from api.services.portfolio.degiro_dividend import _parse_nearest_dividend


ASOF = date(2026, 6, 30)


def _result(items: list[dict]) -> dict:
    return {"data": {"items": items}}


def test_ex_date_taken_from_ex_date_not_payment_date():
    result = _result([{
        "exDate": "2026-07-15",
        "paymentDate": "2026-08-01",
        "amount": 1.5,
        "currency": "EUR",
    }])
    dp = _parse_nearest_dividend(result, ASOF, "NL0000009165")
    assert dp is not None
    assert dp.ex_date == "2026-07-15"


def test_amount_zero_preserved_as_zero():
    result = _result([{
        "exDate": "2026-07-10",
        "amount": 0,
        "currency": "EUR",
    }])
    dp = _parse_nearest_dividend(result, ASOF, "NL0000009165")
    assert dp is not None
    assert dp.amount == 0.0


def test_non_numeric_amount_yields_none():
    result = _result([{
        "exDate": "2026-07-10",
        "amount": "TBD",
        "currency": "EUR",
    }])
    dp = _parse_nearest_dividend(result, ASOF, "NL0000009165")
    assert dp is not None
    assert dp.amount is None


def test_past_ex_date_returns_none():
    result = _result([{
        "exDate": "2026-06-01",  # before ASOF
        "amount": 1.0,
        "currency": "EUR",
    }])
    dp = _parse_nearest_dividend(result, ASOF, "NL0000009165")
    assert dp is None


def test_none_result_returns_none():
    assert _parse_nearest_dividend(None, ASOF, "NL0000009165") is None


def test_empty_items_returns_none():
    assert _parse_nearest_dividend(_result([]), ASOF, "NL0000009165") is None


def test_missing_date_returns_none():
    result = _result([{"amount": 1.0, "currency": "EUR"}])
    assert _parse_nearest_dividend(result, ASOF, "NL0000009165") is None


def test_days_until_computed_correctly():
    result = _result([{
        "exDate": "2026-07-30",
        "amount": 2.0,
        "currency": "USD",
    }])
    dp = _parse_nearest_dividend(result, ASOF, "US0378331005")
    assert dp is not None
    assert dp.days_until == 30


def test_ex_dividend_date_fallback():
    result = _result([{
        "exDividendDate": "2026-07-20",
        "amount": 0.5,
    }])
    dp = _parse_nearest_dividend(result, ASOF, "NL0000009165")
    assert dp is not None
    assert dp.ex_date == "2026-07-20"
