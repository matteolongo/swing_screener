"""DeGiro portfolio reconciliation service.

All degiro_connector imports are lazy. The service is read-only except for
apply(), which upserts local files in an idempotent, no-hard-delete manner.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional

from swing_screener.integrations.degiro.models import (
    DegiroApplyResult,
    DegiroSyncPreview,
    DegiroSyncRaw,
    SyncDiff,
)

logger = logging.getLogger(__name__)


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
                    UpdateRequest(option=UpdateOption.TOTALPORTFOLIO, last_updated=0),
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
            from degiro_connector.trading.models.account import HistoryRequest
            from_dt = date.fromisoformat(from_date)
            to_dt = date.fromisoformat(to_date)
            history = api.get_orders_history(
                history_request=HistoryRequest(from_date=from_dt, to_date=to_dt),
                raw=True,
            ) or {}
            result["order_history"] = history.get("data", [])
        except Exception:
            logger.warning("Failed to fetch DeGiro orders history", exc_info=True)

    # Transactions
    if include_transactions:
        try:
            from degiro_connector.trading.models.transaction import (
                TransactionsHistory,
            )
            from_dt = date.fromisoformat(from_date)
            to_dt = date.fromisoformat(to_date)
            tx_request = TransactionsHistory.Request(
                from_date=TransactionsHistory.Request.Date(
                    year=from_dt.year, month=from_dt.month, day=from_dt.day
                ),
                to_date=TransactionsHistory.Request.Date(
                    year=to_dt.year, month=to_dt.month, day=to_dt.day
                ),
            )
            tx = api.get_transactions_history(request=tx_request, raw=True) or {}
            result["transactions"] = tx.get("data", [])
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
    local_orders: list[dict],
    local_positions: list[dict],
) -> DegiroSyncPreview:
    orders_to_create: list[SyncDiff] = []
    orders_to_update: list[SyncDiff] = []
    ambiguous: list[SyncDiff] = []
    unmatched: list[SyncDiff] = []
    fees_applied = 0

    all_broker_orders = list(sync_raw.order_history) + list(sync_raw.pending_orders)

    for bo in all_broker_orders:
        local, confidence = _match_order(bo, local_orders)
        broker_id = str(bo.get("orderId", "") or "").strip() or None
        fee = _resolve_fee(bo, sync_raw.transactions)

        fields: dict = {}
        if broker_id:
            fields["broker_order_id"] = broker_id
        broker_product = str(bo.get("productId", "") or "").strip() or None
        if broker_product:
            fields["broker_product_id"] = broker_product
        if fee is not None:
            fields["fee_eur"] = fee
            fees_applied += 1

        diff = SyncDiff(
            kind="order",
            action="update" if local else "create",
            local_id=local.get("order_id") if local else None,
            broker_id=broker_id,
            confidence=confidence,
            fields=fields,
        )

        if confidence == "ambiguous":
            ambiguous.append(diff)
        elif confidence == "unmatched":
            unmatched.append(diff)
        elif local:
            orders_to_update.append(diff)
        else:
            orders_to_create.append(diff)

    # Positions
    positions_to_create: list[SyncDiff] = []
    positions_to_update: list[SyncDiff] = []

    for bp in sync_raw.positions:
        product_id = str(bp.get("id", "") or "").strip()
        isin = str(bp.get("isin", "") or "").strip() or None

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

        fields = {}
        if product_id:
            fields["broker_product_id"] = product_id
        if isin:
            fields["isin"] = isin
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
            positions_to_update.append(diff)
        else:
            positions_to_create.append(diff)

    return DegiroSyncPreview(
        positions_to_create=tuple(positions_to_create),
        positions_to_update=tuple(positions_to_update),
        orders_to_create=tuple(orders_to_create),
        orders_to_update=tuple(orders_to_update),
        ambiguous=tuple(ambiguous),
        unmatched=tuple(unmatched),
        fees_applied=fees_applied,
    )


# ---------------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------------

def apply(
    sync_preview: DegiroSyncPreview,
    orders_path: str | Path,
    positions_path: str | Path,
    *,
    artifact_dir: Optional[str | Path] = None,
) -> DegiroApplyResult:
    from swing_screener.utils.file_lock import locked_read_json_cli, locked_write_json_cli

    orders_p = Path(orders_path)
    positions_p = Path(positions_path)

    orders_data = locked_read_json_cli(orders_p) if orders_p.exists() else {"orders": []}
    positions_data = (
        locked_read_json_cli(positions_p) if positions_p.exists() else {"positions": []}
    )

    orders_list: list[dict] = orders_data.get("orders", [])
    positions_list: list[dict] = positions_data.get("positions", [])

    orders_created = orders_updated = 0
    positions_created = positions_updated = 0

    order_idx = {o.get("order_id"): i for i, o in enumerate(orders_list)}
    for diff in sync_preview.orders_to_update:
        if diff.local_id and diff.local_id in order_idx:
            idx = order_idx[diff.local_id]
            orders_list[idx] = {**orders_list[idx], **diff.fields}
            orders_updated += 1

    for diff in sync_preview.orders_to_create:
        new_order = {
            "order_id": f"degiro-{diff.broker_id or uuid.uuid4().hex[:8]}",
            "ticker": "",
            "status": "filled",
            "order_type": "MARKET",
            "quantity": diff.fields.get("quantity", 0),
            **diff.fields,
        }
        orders_list.append(new_order)
        orders_created += 1

    pos_idx = {p.get("position_id"): i for i, p in enumerate(positions_list)}
    for diff in sync_preview.positions_to_update:
        if diff.local_id and diff.local_id in pos_idx:
            idx = pos_idx[diff.local_id]
            positions_list[idx] = {**positions_list[idx], **diff.fields}
            positions_updated += 1

    for diff in sync_preview.positions_to_create:
        new_pos = {
            "position_id": f"degiro-{diff.broker_id or uuid.uuid4().hex[:8]}",
            "ticker": "",
            "status": "open",
            "entry_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "entry_price": 0.0,
            "stop_price": 0.0,
            "shares": diff.fields.get("shares", 0),
            **diff.fields,
        }
        positions_list.append(new_pos)
        positions_created += 1

    asof = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    locked_write_json_cli(orders_p, {**orders_data, "asof": asof, "orders": orders_list})
    locked_write_json_cli(positions_p, {**positions_data, "asof": asof, "positions": positions_list})

    artifact_paths: dict[str, str] = {}
    if artifact_dir:
        artifact_dir_p = Path(artifact_dir)
        artifact_dir_p.mkdir(parents=True, exist_ok=True)
        run_id = uuid.uuid4().hex[:12]
        result_path = artifact_dir_p / f"{run_id}_apply_result.json"
        result_path.write_text(
            json.dumps(
                {
                    "orders_created": orders_created,
                    "orders_updated": orders_updated,
                    "positions_created": positions_created,
                    "positions_updated": positions_updated,
                    "fees_applied": sync_preview.fees_applied,
                    "ambiguous_skipped": len(sync_preview.ambiguous),
                    "asof": asof,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        artifact_paths["apply_result_json"] = str(result_path)

    return DegiroApplyResult(
        positions_created=positions_created,
        positions_updated=positions_updated,
        orders_created=orders_created,
        orders_updated=orders_updated,
        fees_applied=sync_preview.fees_applied,
        ambiguous_skipped=len(sync_preview.ambiguous),
        artifact_paths=artifact_paths,
    )
