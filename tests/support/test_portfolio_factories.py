"""Contract tests for canonical portfolio payload factories."""

from tests.support.factories.portfolio import (
    order_payload,
    orders_document,
    position_payload,
    positions_document,
)


def test_position_factory_has_schema_defaults_and_overrides():
    payload = position_payload(ticker="MSFT", initial_risk=None)
    assert payload["ticker"] == "MSFT"
    assert payload["position_id"] == "POS-001"
    assert payload["initial_risk"] is None


def test_order_factory_has_schema_defaults_and_overrides():
    payload = order_payload(order_id="ORD-XYZ", position_id=None)
    assert payload["order_id"] == "ORD-XYZ"
    assert payload["position_id"] is None
    assert payload["status"] == "pending"


def test_documents_allow_empty_or_explicit_items():
    position = position_payload()
    order = order_payload()
    assert positions_document() == {"asof": "2026-01-01", "positions": []}
    assert orders_document([order], asof="2026-02-01")["orders"] == [order]
    assert positions_document([position])["positions"] == [position]
