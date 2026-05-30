"""DeGiro portfolio reconciliation service.

All degiro_connector imports are lazy. The service is read-only except for
apply(), which idempotently reconciles local files with the latest broker state.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any, Optional

from swing_screener.integrations.degiro.models import (
    DegiroSyncPreview,
    DegiroSyncRaw,
    SyncDiff,
)

logger = logging.getLogger(__name__)


def _sync_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _append_note(existing: Any, note: str) -> str:
    current = _clean_text(existing)
    if not current:
        return note
    if note in current:
        return current
    return f"{current}\n{note}"


def _float_or_none(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _date_only(value: Any) -> Optional[str]:
    text = _clean_text(value)
    if not text:
        return None
    if "T" in text:
        text = text.split("T", 1)[0]
    if " " in text:
        text = text.split(" ", 1)[0]
    return text[:10] if len(text) >= 10 else text


def _transaction_side(tx: dict) -> str:
    raw = _clean_text(tx.get("buysell") or tx.get("side")).upper()
    if raw in {"S", "SELL", "2"}:
        return "sell"
    if raw in {"B", "BUY", "1"}:
        return "buy"
    qty = _float_or_none(tx.get("quantity"))
    if qty is not None:
        if qty < 0:
            return "sell"
        if qty > 0:
            return "buy"
    return ""


def _ticker_variants(value: Any) -> set[str]:
    text = _clean_text(value).upper()
    if not text:
        return set()
    variants = {text}
    base = text.split(".", 1)[0]
    if base:
        variants.add(base)
    variants.add(text.replace(".", ""))
    return {variant for variant in variants if variant}


def _symbols_match(left: Any, right: Any) -> bool:
    left_variants = _ticker_variants(left)
    right_variants = _ticker_variants(right)
    return bool(left_variants and right_variants and left_variants.intersection(right_variants))


def _event_identity(event: dict) -> tuple[str, str, str, str]:
    product_id = _clean_text(
        event.get("productId")
        or event.get("product_id")
        or event.get("resolved_product_id")
    )
    isin = _clean_text(event.get("isin") or event.get("resolved_isin"))
    symbol = _clean_text(
        event.get("resolved_symbol")
        or event.get("symbol")
        or event.get("ticker")
    )
    name = _clean_text(
        event.get("resolved_name")
        or event.get("product")
        or event.get("productName")
        or event.get("name")
    )
    return product_id, isin, symbol, name


def _event_key(event: dict) -> str:
    product_id, isin, symbol, name = _event_identity(event)
    raw_key = _clean_text(event.get("orderId") or event.get("transactionId") or event.get("id"))
    if raw_key:
        return raw_key
    return "|".join((product_id, isin, symbol, name))


def _event_matches_position(event: dict, local_position: dict) -> bool:
    event_product_id, event_isin, event_symbol, _ = _event_identity(event)
    local_product_id = _clean_text(local_position.get("broker_product_id"))
    local_isin = _clean_text(local_position.get("isin"))
    local_ticker = _clean_text(local_position.get("ticker"))

    if event_product_id and local_product_id and event_product_id == local_product_id:
        return True
    if event_isin and local_isin and event_isin == local_isin:
        return True
    if event_symbol and _symbols_match(local_ticker, event_symbol):
        return True
    return False


def _select_exit_event(
    local_position: dict,
    events: list[dict],
    *,
    used_event_keys: Optional[set[str]] = None,
) -> Optional[dict]:
    exit_event = None
    for event in events:
        event_key = _event_key(event)
        if used_event_keys is not None and event_key in used_event_keys:
            continue
        if _transaction_side(event) != "sell":
            continue
        if not _event_matches_position(event, local_position):
            continue
        event_date = _date_only(
            event.get("date")
            or event.get("created")
            or event.get("filledDate")
            or event.get("orderDate")
            or event.get("executionDate")
        )
        entry_date = _clean_text(local_position.get("entry_date"))
        if event_date and entry_date and event_date < entry_date:
            continue
        candidate = (event_date or "", event)
        if exit_event is None or candidate[0] >= exit_event[0]:
            exit_event = candidate
    return exit_event[1] if exit_event is not None else None


def _is_broker_managed_order(local_order: dict) -> bool:
    broker = _clean_text(local_order.get("broker")).lower()
    return bool(
        broker == "degiro"
        or _clean_text(local_order.get("broker_order_id"))
        or _clean_text(local_order.get("broker_product_id"))
        or _clean_text(local_order.get("broker_synced_at"))
    )


def _is_broker_managed_position(local_position: dict) -> bool:
    broker = _clean_text(local_position.get("broker")).lower()
    return bool(
        broker == "degiro"
        or _clean_text(local_position.get("broker_product_id"))
        or _clean_text(local_position.get("broker_synced_at"))
    )


def _stale_position_fields(
    local_position: dict,
    exit_event: Optional[dict],
    sync_stamp: str,
) -> dict:

    fields: dict[str, Any] = {
        "status": "closed",
        "broker": "degiro",
        "broker_synced_at": sync_stamp,
    }
    if exit_event is not None:
        fields["status"] = "closed"
        exit_date = _date_only(
            exit_event.get("date")
            or exit_event.get("created")
            or exit_event.get("filledDate")
            or exit_event.get("orderDate")
            or exit_event.get("executionDate")
        )
        fields["exit_date"] = exit_date or sync_stamp[:10]
        exit_price = _float_or_none(exit_event.get("price"))
        if exit_price is not None:
            fields["exit_price"] = exit_price
        exit_fee = _float_or_none(
            exit_event.get("feeInBaseCurrency") or exit_event.get("totalFeesInBaseCurrency")
        )
        if exit_fee is not None:
            fields["exit_fee_eur"] = exit_fee
    else:
        fields["exit_date"] = sync_stamp[:10]

    fields["notes"] = _append_note(
        local_position.get("notes"),
        "Closed via DeGiro sync: position no longer open at broker.",
    )
    return fields


def _resolve_product_ids(client: Any, items: list[dict], *, product_id_keys: tuple[str, ...]) -> None:
    try:
        from swing_screener.integrations.degiro.resolver import resolve_by_product_id
    except ImportError:
        return

    product_ids: set[str] = set()
    for item in items:
        for key in product_id_keys:
            value = _clean_text(item.get(key))
            if value:
                product_ids.add(value)
                break

    if not product_ids:
        return

    for product_id in sorted(product_ids):
        ref, _, _ = resolve_by_product_id(client, product_id)
        if ref is None:
            continue
        for item in items:
            item_product_id = _clean_text(
                item.get("productId")
                or item.get("product_id")
                or item.get("id")
                or item.get("resolved_product_id")
            )
            if item_product_id != product_id:
                continue
            item["resolved_product_id"] = ref.product_id
            if ref.symbol:
                item["resolved_symbol"] = ref.symbol
            if ref.isin:
                item["resolved_isin"] = ref.isin
            if ref.name:
                item["resolved_name"] = ref.name


# ---------------------------------------------------------------------------
# Raw data fetch
# ---------------------------------------------------------------------------

def fetch_live_data(
    client: Any,
    from_date: str,
    to_date: str,
    *,
    include_portfolio: bool = True,
    include_orders_history: bool = True,
    include_transactions: bool = True,
) -> dict:
    """Fetch raw data from DeGiro using the correct API methods."""
    try:
        from degiro_connector.trading.models.account import UpdateOption, UpdateRequest
    except ImportError as exc:
        raise ImportError(
            "degiro-connector is not installed. Install with: pip install -e '.[degiro]'"
        ) from exc

    api = client.api
    result: dict[str, Any] = {
        "positions": [],
        "pending_orders": [],
        "order_history": [],
        "transactions": [],
        "cash": [],
    }

    # Portfolio positions and cash
    if include_portfolio:
        try:
            update = api.get_update(
                request_list=[
                    UpdateRequest(option=UpdateOption.PORTFOLIO, last_updated=0),
                    UpdateRequest(option=UpdateOption.TOTAL_PORTFOLIO, last_updated=0),
                ],
                raw=True,
            ) or {}
            portfolio_items = update.get("portfolio", {}).get("value", [])
            positions = []
            cash = []
            for item in portfolio_items:
                vals = {v["name"]: v["value"] for v in item.get("value", []) if "value" in v}
                if vals.get("positionType") == "CASH":
                    cash.append(vals)
                elif vals.get("size", 0) and float(vals.get("size", 0)) != 0:
                    positions.append(vals)
            result["positions"] = positions
            result["cash"] = cash
            _resolve_product_ids(client, positions, product_id_keys=("id", "productId", "product_id"))
        except Exception:
            logger.warning("Failed to fetch DeGiro portfolio", exc_info=True)

    # Pending orders
    if include_orders_history:
        try:
            update = api.get_update(
                request_list=[UpdateRequest(option=UpdateOption.ORDERS, last_updated=0)],
                raw=True,
            ) or {}
            result["pending_orders"] = update.get("orders", {}).get("value", [])
        except Exception:
            logger.warning("Failed to fetch DeGiro pending orders", exc_info=True)

        # Order history
        try:
            from degiro_connector.trading.models.order import HistoryRequest
            from_dt = date.fromisoformat(from_date)
            to_dt = date.fromisoformat(to_date)
            history = api.get_orders_history(
                history_request=HistoryRequest(from_date=from_dt, to_date=to_dt),
                raw=True,
            ) or {}
            result["order_history"] = history.get("data", [])
            _resolve_product_ids(
                client,
                result["order_history"],
                product_id_keys=("productId", "product_id"),
            )
        except Exception:
            logger.warning("Failed to fetch DeGiro orders history", exc_info=True)

    # Transactions
    if include_transactions:
        try:
            from degiro_connector.trading.models.transaction import HistoryRequest as TxHistoryRequest
            from_dt = date.fromisoformat(from_date)
            to_dt = date.fromisoformat(to_date)
            tx_request = TxHistoryRequest(from_date=from_dt, to_date=to_dt)
            tx = api.get_transactions_history(transaction_request=tx_request, raw=True) or {}
            result["transactions"] = tx.get("data", [])
            _resolve_product_ids(
                client,
                result["transactions"],
                product_id_keys=("productId", "product_id"),
            )
        except Exception:
            logger.warning("Failed to fetch DeGiro transactions", exc_info=True)

    return result


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

def normalize(raw: dict) -> DegiroSyncRaw:
    return DegiroSyncRaw(
        positions=raw.get("positions", []),
        pending_orders=raw.get("pending_orders", []),
        order_history=raw.get("order_history", []),
        transactions=raw.get("transactions", []),
        cash=raw.get("cash", []),
    )


# ---------------------------------------------------------------------------
# Matching helpers
# ---------------------------------------------------------------------------

def _match_order(broker_order: dict, local_orders: list[dict]) -> tuple[Optional[dict], str]:
    broker_id = str(broker_order.get("orderId", "")).strip()

    # Priority 1: broker_order_id exact match
    if broker_id:
        for lo in local_orders:
            if str(lo.get("broker_order_id", "") or "").strip() == broker_id:
                return lo, "exact"

    # Priority 2: product_id + side + quantity + date
    broker_product = str(broker_order.get("productId", "") or "").strip()
    broker_qty = abs(int(broker_order.get("size", 0) or broker_order.get("quantity", 0) or 0))
    broker_date = str(broker_order.get("created", "") or broker_order.get("date", ""))[:10]
    broker_side = "buy" if str(broker_order.get("buysell", "")).upper() in ("B", "BUY", "1") else "sell"

    fuzzy_hits = []
    for lo in local_orders:
        lo_product = str(lo.get("broker_product_id", "") or "").strip()
        lo_qty = abs(int(lo.get("quantity", 0) or 0))
        lo_date = str(lo.get("order_date", "") or lo.get("filled_date", ""))[:10]
        lo_type = str(lo.get("order_type", "")).upper()
        lo_side = "buy" if "BUY" in lo_type else "sell"
        if (
            lo_product
            and lo_product == broker_product
            and lo_qty == broker_qty
            and lo_date == broker_date
            and lo_side == broker_side
        ):
            fuzzy_hits.append(lo)

    if len(fuzzy_hits) == 1:
        return fuzzy_hits[0], "fuzzy"
    if len(fuzzy_hits) > 1:
        return None, "ambiguous"

    # Priority 3: ISIN match
    broker_isin = str(broker_order.get("isin", "") or "").strip()
    isin_hits = [lo for lo in local_orders if broker_isin and lo.get("isin") == broker_isin]
    if len(isin_hits) == 1:
        return isin_hits[0], "fuzzy"
    if len(isin_hits) > 1:
        return None, "ambiguous"

    return None, "unmatched"


def _resolve_fee(broker_order: dict, transactions: list[dict]) -> Optional[float]:
    broker_id = str(broker_order.get("orderId", "") or "").strip()
    for tx in transactions:
        if str(tx.get("orderId", "") or "").strip() == broker_id:
            fee = tx.get("feeInBaseCurrency") or tx.get("totalFeesInBaseCurrency")
            if fee is not None:
                return float(fee)
    return None


# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------

def preview(
    sync_raw: DegiroSyncRaw,
    local_positions: list[dict],
) -> DegiroSyncPreview:
    """Compute position-only diffs (orders are now read live from DeGiro)."""
    sync_stamp = _sync_timestamp()
    positions_to_create: list[SyncDiff] = []
    positions_to_update: list[SyncDiff] = []
    matched_local_position_ids: set[str] = set()
    exit_events = list(sync_raw.order_history) + list(sync_raw.transactions)
    used_exit_event_keys: set[str] = set()

    for bp in sync_raw.positions:
        product_id = _clean_text(bp.get("id") or bp.get("productId") or bp.get("product_id"))
        isin = _clean_text(bp.get("isin") or bp.get("resolved_isin")) or None
        symbol = _clean_text(bp.get("resolved_symbol") or bp.get("symbol")) or None

        local_pos = None
        pos_confidence = "unmatched"
        for lp in local_positions:
            if product_id and str(lp.get("broker_product_id", "") or "").strip() == product_id:
                local_pos = lp
                pos_confidence = "exact"
                break
            if isin and str(lp.get("isin", "") or "").strip() == isin:
                local_pos = lp
                pos_confidence = "fuzzy"
                break
            if symbol and _symbols_match(lp.get("ticker"), symbol):
                local_pos = lp
                pos_confidence = "fuzzy"
                break

        fields: dict = {}
        if product_id:
            fields["broker_product_id"] = product_id
        if isin:
            fields["isin"] = isin
        if symbol:
            fields["broker_symbol"] = symbol
        fields["broker"] = "degiro"
        fields["broker_synced_at"] = sync_stamp
        size = bp.get("size") or bp.get("quantity")
        if size is not None:
            fields["shares"] = int(float(size))

        diff = SyncDiff(
            kind="position",
            action="update" if local_pos else "create",
            local_id=local_pos.get("position_id") if local_pos else None,
            broker_id=product_id or None,
            confidence=pos_confidence,
            fields=fields,
        )

        if local_pos:
            if diff.local_id:
                matched_local_position_ids.add(diff.local_id)
            positions_to_update.append(diff)
        else:
            positions_to_create.append(diff)

    # Mark locally-open positions as stale if a matching DeGiro exit is present
    stale_candidates = sorted(
        local_positions,
        key=lambda pos: (
            _clean_text(pos.get("entry_date")),
            _clean_text(pos.get("position_id")),
        ),
    )

    for lp in stale_candidates:
        local_id = _clean_text(lp.get("position_id"))
        if not local_id or local_id in matched_local_position_ids:
            continue
        if _clean_text(lp.get("status")).lower() != "open":
            continue
        exit_event = _select_exit_event(lp, exit_events, used_event_keys=used_exit_event_keys)
        if exit_event is None and not _is_broker_managed_position(lp):
            continue
        if exit_event is not None:
            used_exit_event_keys.add(_event_key(exit_event))

        broker_id = _clean_text(lp.get("broker_product_id")) or None
        diff = SyncDiff(
            kind="position",
            action="update",
            local_id=local_id,
            broker_id=broker_id,
            confidence="exact" if broker_id else "fuzzy",
            fields=_stale_position_fields(lp, exit_event, sync_stamp),
        )
        positions_to_update.append(diff)

    return DegiroSyncPreview(
        positions_to_create=tuple(positions_to_create),
        positions_to_update=tuple(positions_to_update),
        orders_to_create=(),
        orders_to_update=(),
        ambiguous=(),
        unmatched=(),
        fees_applied=0,
    )
