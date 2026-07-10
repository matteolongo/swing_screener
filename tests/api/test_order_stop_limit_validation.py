"""CreateOrderRequest stop/limit validation is scoped to long (BUY) entry orders."""

import pytest
from pydantic import ValidationError

from api.models.portfolio import CreateOrderRequest


def test_long_entry_rejects_stop_at_or_above_limit():
    with pytest.raises(ValidationError, match="stop_price must be below limit_price"):
        CreateOrderRequest(
            ticker="AAPL",
            order_type="BUY_LIMIT",
            quantity=10,
            limit_price=100.0,
            stop_price=100.0,
            order_kind="entry",
        )


def test_sell_stop_limit_allows_stop_at_or_above_limit():
    # Protective SELL stop-limit: trigger (stop) above the limit cap is normal.
    order = CreateOrderRequest(
        ticker="VALE",
        order_type="SELL_STOP",
        quantity=6,
        stop_price=48.0,
        limit_price=47.5,
        order_kind="stop",
    )
    assert order.stop_price == 48.0
    assert order.limit_price == 47.5


def test_long_entry_stop_below_limit_is_valid():
    order = CreateOrderRequest(
        ticker="AAPL",
        order_type="BUY_LIMIT",
        quantity=10,
        limit_price=100.0,
        stop_price=95.0,
        order_kind="entry",
    )
    assert order.stop_price == 95.0
