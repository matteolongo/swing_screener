from __future__ import annotations

from decimal import Decimal

import pytest

from api.services.order_exposure import (
    ExposureContextError,
    ProposedExposure,
    build_exposure_snapshot,
    quote_to_account,
)


def test_same_currency_uses_identity_even_when_rate_is_supplied():
    assert quote_to_account(Decimal("100"), "EUR", "EUR", Decimal("1.5")) == Decimal(
        "100"
    )


def test_cross_currency_amounts_divide_by_account_to_quote_rate():
    assert quote_to_account(Decimal("110"), "EUR", "USD", Decimal("1.1")) == Decimal(
        "100"
    )


def test_snapshot_normalizes_open_pending_and_proposed_exposure():
    positions = [
        {
            "ticker": "SAP.DE",
            "status": "open",
            "entry_price": 100,
            "stop_price": 95,
            "shares": 10,
            "quote_currency": "EUR",
            "entry_fx_rate": 1,
        }
    ]
    orders = [
        {
            "ticker": "MSFT",
            "status": "pending",
            "order_kind": "entry",
            "limit_price": 110,
            "stop_price": 99,
            "quantity": 10,
            "quote_currency": "USD",
            "account_to_quote_rate": 1.1,
        }
    ]
    proposed = ProposedExposure(
        ticker="AAPL",
        quantity=10,
        entry=Decimal("110"),
        stop=Decimal("104.5"),
        account_currency="EUR",
        quote_currency="USD",
        account_to_quote_rate=Decimal("1.1"),
    )

    snapshot = build_exposure_snapshot(positions, orders, proposed)

    assert snapshot.current_notional == Decimal("2000")
    assert snapshot.current_risk == Decimal("150")
    assert snapshot.projected_notional == Decimal("3000")
    assert snapshot.projected_price_risk == Decimal("200")
    assert len(snapshot.lines) == 3


def test_closed_and_cancelled_rows_are_excluded():
    proposed = ProposedExposure(
        ticker="SAP.DE",
        quantity=1,
        entry=Decimal("100"),
        stop=Decimal("95"),
        account_currency="EUR",
        quote_currency="EUR",
        account_to_quote_rate=Decimal("1"),
    )
    snapshot = build_exposure_snapshot(
        [
            {
                "ticker": "OLD",
                "status": "closed",
                "entry_price": 100,
                "stop_price": 1,
                "shares": 100,
            }
        ],
        [
            {
                "ticker": "OLD",
                "status": "cancelled",
                "order_kind": "entry",
                "limit_price": 100,
                "stop_price": 1,
                "quantity": 100,
            }
        ],
        proposed,
    )
    assert snapshot.current_notional == 0
    assert snapshot.projected_notional == Decimal("100")


def test_missing_legacy_cross_currency_fx_fails_closed():
    proposed = ProposedExposure(
        ticker="SAP.DE",
        quantity=1,
        entry=Decimal("100"),
        stop=Decimal("95"),
        account_currency="EUR",
        quote_currency="EUR",
        account_to_quote_rate=Decimal("1"),
    )
    positions = [
        {
            "ticker": "AAPL",
            "status": "open",
            "entry_price": 100,
            "stop_price": 95,
            "shares": 10,
            "quote_currency": "USD",
        }
    ]

    with pytest.raises(ExposureContextError, match="FX_CONTEXT_MISSING"):
        build_exposure_snapshot(positions, [], proposed)


def test_existing_exposure_with_different_account_currency_fails_closed():
    proposed = ProposedExposure(
        ticker="SAP.DE",
        quantity=1,
        entry=Decimal("100"),
        stop=Decimal("95"),
        account_currency="GBP",
        quote_currency="EUR",
        account_to_quote_rate=Decimal("1.16"),
    )
    positions = [
        {
            "ticker": "AAPL",
            "status": "open",
            "entry_price": 100,
            "stop_price": 95,
            "shares": 10,
            "account_currency": "EUR",
            "quote_currency": "USD",
            "entry_fx_rate": 1.1,
        }
    ]

    with pytest.raises(ExposureContextError, match="ACCOUNT_CURRENCY_MISMATCH"):
        build_exposure_snapshot(positions, [], proposed)
