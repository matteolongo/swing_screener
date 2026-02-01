from __future__ import annotations

from copy import deepcopy
from datetime import date
import json
from pathlib import Path
from typing import Any, Iterable

import pandas as pd

from swing_screener.data.market_data import MarketDataConfig, fetch_ohlcv, fetch_ticker_metadata
from swing_screener.data.universe import UniverseConfig as DataUniverseConfig, load_universe_from_package
from swing_screener.reporting.report import ReportConfig, build_daily_report
from swing_screener.screeners.ranking import RankingConfig
from swing_screener.screeners.universe import UniverseConfig as ScreenUniverseConfig, UniverseFilterConfig
from swing_screener.risk.position_sizing import RiskConfig

ORDER_STATUSES = {"pending", "filled", "cancelled"}
ORDER_TYPES = {"BUY_LIMIT", "BUY_STOP", "SKIP"}
POSITION_STATUSES = {"open", "closed"}


class PatchError(ValueError):
    pass


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def load_orders(path: str | Path) -> tuple[list[dict[str, Any]], str | None]:
    p = Path(path)
    if not p.exists():
        return [], None
    payload = json.loads(p.read_text(encoding="utf-8"))
    orders = []
    for idx, item in enumerate(payload.get("orders", [])):
        orders.append(_normalize_order(item, idx))
    return orders, payload.get("asof")


def save_orders(path: str | Path, orders: Iterable[dict[str, Any]], asof: str | None = None) -> None:
    p = Path(path)
    payload = {"asof": asof, "orders": list(orders)}
    if p.parent and p.parent != Path("."):
        p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_positions(path: str | Path) -> tuple[list[dict[str, Any]], str | None]:
    p = Path(path)
    if not p.exists():
        return [], None
    payload = json.loads(p.read_text(encoding="utf-8"))
    positions = []
    for item in payload.get("positions", []):
        positions.append(_normalize_position(item))
    return positions, payload.get("asof")


def save_positions(
    path: str | Path,
    positions: Iterable[dict[str, Any]],
    asof: str | None = None,
) -> None:
    p = Path(path)
    payload = {"asof": asof, "positions": list(positions)}
    if p.parent and p.parent != Path("."):
        p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def preview_changes(
    orders: list[dict[str, Any]],
    positions: list[dict[str, Any]],
    order_patches: Iterable[dict[str, Any]] | None = None,
    position_patches: Iterable[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    updated_orders, updated_positions = apply_patches(
        orders,
        positions,
        order_patches=order_patches,
        position_patches=position_patches,
    )
    return build_diff(orders, positions, updated_orders, updated_positions)


def apply_patches(
    orders: list[dict[str, Any]],
    positions: list[dict[str, Any]],
    order_patches: Iterable[dict[str, Any]] | None = None,
    position_patches: Iterable[dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    order_patches = list(order_patches or [])
    position_patches = list(position_patches or [])

    orders_copy = deepcopy(orders)
    positions_copy = deepcopy(positions)

    orders_by_id = {o.get("order_id"): o for o in orders_copy if o.get("order_id")}
    positions_by_ticker = {p.get("ticker"): p for p in positions_copy if p.get("ticker")}

    lock_by_ticker: dict[str, bool] = {}
    for order in orders_copy:
        ticker = str(order.get("ticker", "")).strip().upper()
        if not ticker:
            continue
        lock_by_ticker[ticker] = lock_by_ticker.get(ticker, False) or bool(order.get("locked", False))
    for pos in positions_copy:
        ticker = str(pos.get("ticker", "")).strip().upper()
        if not ticker:
            continue
        lock_by_ticker[ticker] = lock_by_ticker.get(ticker, False) or bool(pos.get("locked", False))

    lock_updates: dict[str, bool] = {}

    for patch in order_patches:
        order_id = str(patch.get("order_id", "")).strip()
        if not order_id or order_id not in orders_by_id:
            raise PatchError("order_id is required and must exist.")
        order = orders_by_id[order_id]
        ticker = str(order.get("ticker", "")).strip().upper()
        if not ticker:
            raise PatchError(f"{order_id}: missing ticker.")

        _apply_order_patch(
            order,
            patch,
            is_locked=lock_by_ticker.get(ticker, False),
            lock_updates=lock_updates,
            ticker=ticker,
        )

    for patch in position_patches:
        ticker = str(patch.get("ticker", "")).strip().upper()
        if not ticker or ticker not in positions_by_ticker:
            raise PatchError("ticker is required and must exist.")
        position = positions_by_ticker[ticker]

        _apply_position_patch(
            position,
            patch,
            is_locked=lock_by_ticker.get(ticker, False),
            lock_updates=lock_updates,
            ticker=ticker,
        )

    for ticker, locked in lock_updates.items():
        for order in orders_copy:
            if str(order.get("ticker", "")).strip().upper() == ticker:
                order["locked"] = locked
        if ticker in positions_by_ticker:
            positions_by_ticker[ticker]["locked"] = locked

    return orders_copy, positions_copy


def build_diff(
    old_orders: list[dict[str, Any]],
    old_positions: list[dict[str, Any]],
    new_orders: list[dict[str, Any]],
    new_positions: list[dict[str, Any]],
) -> dict[str, Any]:
    old_orders_by_id = {o.get("order_id"): o for o in old_orders if o.get("order_id")}
    old_positions_by_ticker = {p.get("ticker"): p for p in old_positions if p.get("ticker")}

    order_changes = []
    for order in new_orders:
        order_id = order.get("order_id")
        if not order_id or order_id not in old_orders_by_id:
            continue
        changes = _diff_fields(old_orders_by_id[order_id], order)
        if changes:
            order_changes.append({"order_id": order_id, "changes": changes})

    position_changes = []
    for position in new_positions:
        ticker = position.get("ticker")
        if not ticker or ticker not in old_positions_by_ticker:
            continue
        changes = _diff_fields(old_positions_by_ticker[ticker], position)
        if changes:
            position_changes.append({"ticker": ticker, "changes": changes})

    return {"diff": {"orders": order_changes, "positions": position_changes}, "warnings": []}


def apply_to_files(
    orders_path: str | Path,
    positions_path: str | Path,
    order_patches: Iterable[dict[str, Any]] | None = None,
    position_patches: Iterable[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    order_patches = list(order_patches or [])
    position_patches = list(position_patches or [])
    orders, orders_asof = load_orders(orders_path)
    positions, positions_asof = load_positions(positions_path)
    if not order_patches and not position_patches:
        asof = orders_asof or positions_asof or date.today().isoformat()
        return {"success": True, "asof": asof}
    updated_orders, updated_positions = apply_patches(
        orders,
        positions,
        order_patches=order_patches,
        position_patches=position_patches,
    )
    today = date.today().isoformat()
    save_orders(orders_path, updated_orders, asof=today)
    save_positions(positions_path, updated_positions, asof=today)
    return {"success": True, "asof": today}


def run_screening_preview(
    universe: str,
    top_n: int,
    account_size: float,
    risk_pct: float,
    k_atr: float,
    max_position_pct: float,
    use_cache: bool,
    force_refresh: bool,
    min_price: float,
    max_price: float,
    max_atr_pct: float,
    require_trend_ok: bool,
) -> tuple[pd.DataFrame, str]:
    ucfg = DataUniverseConfig(benchmark="SPY", ensure_benchmark=True, max_tickers=top_n or None)
    tickers = load_universe_from_package(universe, ucfg)

    ranking_top_n = top_n if top_n and top_n > 0 else 10_000

    ohlcv = fetch_ohlcv(
        tickers,
        MarketDataConfig(),
        use_cache=use_cache,
        force_refresh=force_refresh,
    )

    rcfg = ReportConfig(
        universe=ScreenUniverseConfig(
            filt=UniverseFilterConfig(
                min_price=min_price,
                max_price=max_price,
                max_atr_pct=max_atr_pct,
                require_trend_ok=require_trend_ok,
            )
        ),
        ranking=RankingConfig(top_n=ranking_top_n),
        risk=RiskConfig(
            account_size=account_size,
            risk_pct=risk_pct / 100.0,
            k_atr=k_atr,
            max_position_pct=max_position_pct,
        ),
    )
    report = build_daily_report(ohlcv, rcfg)

    try:
        meta_df = fetch_ticker_metadata(
            report.index.tolist(),
            cache_path=".cache/ticker_meta.json",
            use_cache=use_cache,
            force_refresh=force_refresh,
        )
        if not meta_df.empty:
            meta_df = meta_df.reindex(report.index)
            report.insert(0, "exchange", meta_df["exchange"])
            report.insert(0, "currency", meta_df["currency"])
            report.insert(0, "name", meta_df["name"])
    except Exception:
        pass

    csv_text = report.to_csv(index=True)
    return report, csv_text


def _normalize_order(item: dict[str, Any], idx: int) -> dict[str, Any]:
    order = dict(item)
    ticker = str(order.get("ticker", "")).strip().upper()
    if not ticker:
        return order
    order_id = str(order.get("order_id", "")).strip() or f"{ticker}-{idx + 1}"

    status_raw = str(order.get("status", "pending")).strip().lower()
    status = status_raw if status_raw in ORDER_STATUSES else "pending"

    order_type = str(order.get("order_type", "")).strip().upper()
    if order_type and order_type not in ORDER_TYPES:
        order_type = ""

    order.update(
        {
            "order_id": order_id,
            "ticker": ticker,
            "status": status,
            "order_type": order_type,
            "order_date": str(order.get("order_date", "") or "").strip(),
            "filled_date": str(order.get("filled_date", "") or "").strip(),
            "commission": _optional_float(order.get("commission")),
            "notes": str(order.get("notes", "") or "").strip(),
            "locked": bool(order.get("locked", False)),
        }
    )
    return order


def _normalize_position(item: dict[str, Any]) -> dict[str, Any]:
    position = dict(item)
    ticker = str(position.get("ticker", "")).strip().upper()
    if not ticker:
        return position

    status_raw = str(position.get("status", "open")).strip().lower()
    status = status_raw if status_raw in POSITION_STATUSES else "open"

    position.update(
        {
            "ticker": ticker,
            "status": status,
            "entry_date": str(position.get("entry_date", "") or "").strip(),
            "notes": str(position.get("notes", "") or "").strip(),
            "locked": bool(position.get("locked", False)),
        }
    )
    return position


def _apply_order_patch(
    order: dict[str, Any],
    patch: dict[str, Any],
    is_locked: bool,
    lock_updates: dict[str, bool],
    ticker: str,
) -> None:
    keys = {k for k in patch.keys() if k != "order_id"}
    if is_locked and keys != {"locked"}:
        raise PatchError(f"{ticker}: locked; edits not allowed.")

    if "status" in patch:
        status = str(patch["status"]).strip().lower()
        if status not in ORDER_STATUSES:
            raise PatchError(f"{ticker}: invalid order status.")
        order["status"] = status

    if "order_type" in patch:
        order_type = str(patch["order_type"]).strip().upper()
        if order_type and order_type not in ORDER_TYPES:
            raise PatchError(f"{ticker}: invalid order type.")
        order["order_type"] = order_type

    for key in (
        "limit_price",
        "quantity",
        "stop_price",
        "order_date",
        "filled_date",
        "entry_price",
        "commission",
        "notes",
    ):
        if key in patch:
            order[key] = patch[key]

    if "locked" in patch:
        lock_updates[ticker] = bool(patch["locked"])


def _apply_position_patch(
    position: dict[str, Any],
    patch: dict[str, Any],
    is_locked: bool,
    lock_updates: dict[str, bool],
    ticker: str,
) -> None:
    allowed = {"stop_price", "status", "locked"}
    extras = set(patch.keys()) - allowed - {"ticker"}
    if extras:
        raise PatchError(f"{ticker}: unsupported position fields: {sorted(extras)}")

    if is_locked and set(patch.keys()) != {"ticker", "locked"}:
        raise PatchError(f"{ticker}: locked; edits not allowed.")

    if "status" in patch:
        status = str(patch["status"]).strip().lower()
        if status not in POSITION_STATUSES:
            raise PatchError(f"{ticker}: invalid position status.")
        position["status"] = status

    if "stop_price" in patch:
        position["stop_price"] = patch["stop_price"]

    if "locked" in patch:
        lock_updates[ticker] = bool(patch["locked"])


def _diff_fields(old: dict[str, Any], new: dict[str, Any]) -> dict[str, list[Any]]:
    changes: dict[str, list[Any]] = {}
    keys = set(old.keys()) | set(new.keys())
    for key in keys:
        if old.get(key) != new.get(key):
            changes[key] = [old.get(key), new.get(key)]
    return changes
