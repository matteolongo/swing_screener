"""Canonical JSON payloads used by JSON-backed portfolio API tests."""

from __future__ import annotations

_POSITION_DEFAULTS: dict[str, object] = {
    "position_id": "POS-001",
    "ticker": "AAPL",
    "status": "open",
    "entry_date": "2026-01-01",
    "entry_price": 100.0,
    "stop_price": 95.0,
    "shares": 10,
    "initial_risk": 5.0,
    "notes": "",
    "tags": [],
}

_ORDER_DEFAULTS: dict[str, object] = {
    "order_id": "ORD-001",
    "ticker": "AAPL",
    "status": "pending",
    "order_kind": "entry",
    "order_type": "LIMIT",
    "quantity": 10,
    "limit_price": 100.0,
    "stop_price": 95.0,
    "order_date": "2026-01-01",
    "filled_date": None,
    "entry_price": None,
    "notes": "",
    "parent_order_id": None,
    "position_id": None,
    "tif": "GTC",
    "fee_eur": None,
    "fill_fx_rate": None,
    "isin": None,
    "thesis": None,
}


def position_payload(**overrides: object) -> dict[str, object]:
    """Return a valid position-shaped mapping with explicit override support."""
    payload = dict(_POSITION_DEFAULTS)
    payload["tags"] = list(_POSITION_DEFAULTS["tags"])  # avoid shared mutable state
    payload.update(overrides)
    return payload


def order_payload(**overrides: object) -> dict[str, object]:
    """Return a valid order-shaped mapping with explicit override support."""
    payload = dict(_ORDER_DEFAULTS)
    payload.update(overrides)
    return payload


def positions_document(
    positions: list[dict[str, object]] | None = None,
    *,
    asof: str = "2026-01-01",
) -> dict[str, object]:
    """Build the complete persisted positions document."""
    return {"asof": asof, "positions": list(positions or [])}


def orders_document(
    orders: list[dict[str, object]] | None = None,
    *,
    asof: str = "2026-01-01",
) -> dict[str, object]:
    """Build the complete persisted orders document."""
    return {"asof": asof, "orders": list(orders or [])}


__all__ = [
    "order_payload",
    "orders_document",
    "position_payload",
    "positions_document",
]
