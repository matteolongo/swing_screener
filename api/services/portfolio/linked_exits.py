"""Pure reconciliation for local protective-order records."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from swing_screener.errors import ConflictError

_ACTIVE_STATUSES = {"pending", "submitted"}
_PROTECTIVE_KINDS = {"stop", "take_profit"}


def linked_stop_order_id(position_id: str) -> str:
    """Return the canonical local ledger ID for a position's stop record."""
    return f"ORD-STOP-{position_id}"


def reconcile_linked_exit_records(
    position: Mapping[str, object],
    orders: Sequence[Mapping[str, object]],
    *,
    filled_exit_order_id: str | None = None,
) -> list[dict[str, object]]:
    """Return local orders reconciled to one position without performing I/O.

    Only active stop and take-profit records linked by the exact position ID are
    changed. A final exit cancels those records, while an open position keeps a
    full-position protective record aligned with the remaining share count.
    """
    position_id = str(position.get("position_id") or "")
    status = str(position.get("status") or "")
    shares = int(position.get("shares") or 0)
    desired = [dict(order) for order in orders]

    active_by_kind: dict[str, list[dict[str, object]]] = {}
    for order in desired:
        if (
            order.get("position_id") != position_id
            or str(order.get("status") or "") not in _ACTIVE_STATUSES
            or str(order.get("order_kind") or "") not in _PROTECTIVE_KINDS
        ):
            continue
        kind = str(order["order_kind"])
        active_by_kind.setdefault(kind, []).append(order)

    ambiguous_kinds = [
        kind for kind, records in active_by_kind.items() if len(records) > 1
    ]
    if ambiguous_kinds:
        raise ConflictError(
            "Multiple active linked protective orders require manual reconciliation: "
            + ", ".join(sorted(ambiguous_kinds))
        )

    for records in active_by_kind.values():
        order = records[0]
        if order.get("order_id") == filled_exit_order_id:
            continue
        if status == "closed":
            order["status"] = "cancelled"
        elif (
            status == "open"
            and shares > 0
            and int(order.get("quantity") or 0) >= shares
        ):
            order["quantity"] = shares

    return desired
