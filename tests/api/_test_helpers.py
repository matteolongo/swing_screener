"""Shared test helper factories for API tests."""

from __future__ import annotations

from types import SimpleNamespace

from tests.support.factories.portfolio import order_payload, position_payload


def make_position(
    *,
    ticker: str = "AAPL",
    position_id: str = "POS-001",
    entry_price: float = 100.0,
    current_price: float | None = None,
    stop_price: float = 95.0,
    shares: int = 10,
    status: str = "open",
) -> SimpleNamespace:
    payload = position_payload(
        ticker=ticker,
        position_id=position_id,
        entry_price=entry_price,
        stop_price=stop_price,
        shares=shares,
        status=status,
    )
    return SimpleNamespace(
        **payload,
        current_price=current_price if current_price is not None else entry_price,
    )


def make_order(
    *,
    ticker: str = "AAPL",
    order_id: str = "ORD-001",
    status: str = "pending",
    order_kind: str = "entry",
    position_id: str | None = None,
) -> SimpleNamespace:
    payload = order_payload(
        ticker=ticker,
        order_id=order_id,
        status=status,
        order_kind=order_kind,
        position_id=position_id,
    )
    return SimpleNamespace(
        **payload,
    )
