from __future__ import annotations

from pathlib import Path
from datetime import datetime
from typing import Iterable, Optional
import json

import pandas as pd

from swing_screener.execution.orders import Order

from swing_screener.portfolio.state import Position, load_positions

try:
    from importlib import resources as importlib_resources
except Exception:  # pragma: no cover
    import importlib_resources  # type: ignore


def list_available_universes() -> list[str]:
    try:
        base = importlib_resources.files("swing_screener.data").joinpath("universes")
    except Exception:
        return []

    names: list[str] = []
    try:
        for p in base.iterdir():
            if p.is_file() and p.name.endswith(".csv"):
                names.append(p.stem)
    except Exception:
        return []

    return sorted(names)


def ensure_parent_dir(path: str | Path) -> None:
    p = Path(path)
    parent = p.parent
    if parent and parent != Path("."):
        parent.mkdir(parents=True, exist_ok=True)


def load_positions_to_dataframe(path: str | Path) -> pd.DataFrame:
    positions = load_positions(path)
    rows = [
        {
            "ticker": p.ticker,
            "status": p.status,
            "entry_date": p.entry_date,
            "entry_price": p.entry_price,
            "stop_price": p.stop_price,
            "shares": p.shares,
            "notes": p.notes,
        }
        for p in positions
    ]
    return pd.DataFrame(rows)


def dataframe_to_positions(
    df: pd.DataFrame,
    existing: Optional[Iterable[Position]] = None,
) -> list[Position]:
    existing_map = {p.ticker.upper(): p for p in (existing or [])}

    out: list[Position] = []
    for _, row in df.iterrows():
        ticker = str(row.get("ticker", "")).strip().upper()
        if not ticker:
            continue

        prev = existing_map.get(ticker)

        status_raw = str(row.get("status", prev.status if prev else "open")).strip()
        status = status_raw if status_raw in {"open", "closed"} else "open"

        entry_date = row.get("entry_date", prev.entry_date if prev else "")
        entry_date = str(entry_date).strip()
        if not entry_date:
            raise ValueError(f"{ticker}: entry_date is required.")

        entry_price = row.get("entry_price", prev.entry_price if prev else None)
        stop_price = row.get("stop_price", prev.stop_price if prev else None)
        shares = row.get("shares", prev.shares if prev else None)

        if entry_price is None or stop_price is None or shares is None:
            raise ValueError(f"{ticker}: entry_price, stop_price, shares are required.")

        notes = row.get("notes", prev.notes if prev else "")

        out.append(
            Position(
                ticker=ticker,
                status=status,  # type: ignore[arg-type]
                entry_date=entry_date,
                entry_price=float(entry_price),
                stop_price=float(stop_price),
                shares=int(shares),
                position_id=prev.position_id if prev else None,
                source_order_id=prev.source_order_id if prev else None,
                initial_risk=prev.initial_risk if prev else None,
                max_favorable_price=prev.max_favorable_price if prev else None,
                notes=str(notes) if notes is not None else "",
                exit_order_ids=prev.exit_order_ids if prev else None,
            )
        )

    return out


def safe_read_csv_preview(path: str | Path, nrows: int = 50) -> tuple[pd.DataFrame, Optional[str]]:
    p = Path(path)
    if not p.exists():
        return pd.DataFrame(), None
    try:
        return pd.read_csv(p, nrows=nrows), None
    except Exception as e:
        return pd.DataFrame(), str(e)


def read_last_run(path: str | Path) -> Optional[str]:
    p = Path(path)
    if not p.exists():
        return None
    try:
        payload = json.loads(p.read_text(encoding="utf-8"))
        return str(payload.get("last_run"))
    except Exception:
        return None


def write_last_run(path: str | Path, ts: str) -> None:
    p = Path(path)
    ensure_parent_dir(p)
    p.write_text(json.dumps({"last_run": ts}, indent=2), encoding="utf-8")


def load_user_defaults(path: str | Path) -> dict:
    p = Path(path)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_user_defaults(path: str | Path, values: dict) -> None:
    p = Path(path)
    serializable = {}
    for k, v in values.items():
        if hasattr(v, "isoformat"):
            serializable[k] = v.isoformat()
        else:
            serializable[k] = v
    ensure_parent_dir(p)
    p.write_text(json.dumps(serializable, indent=2), encoding="utf-8")


def load_backtest_configs(path: str | Path) -> list[dict]:
    p = Path(path)
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
        return []
    except Exception:
        return []


def save_backtest_configs(path: str | Path, configs: list[dict]) -> None:
    p = Path(path)
    ensure_parent_dir(p)
    p.write_text(json.dumps(configs, indent=2), encoding="utf-8")


def build_action_badge(row: pd.Series) -> dict:
    order_type = row.get("suggested_order_type", None)
    order_price = row.get("suggested_order_price", None)
    note = row.get("execution_note", "")

    def _badge(text: str, bg_color: str) -> dict:
        return {
            "text": text,
            "bg_color": bg_color,
            "text_color": "#1a1a1a",
            "tooltip": str(note) if pd.notna(note) and str(note).strip() else "",
        }

    if order_type is None or pd.isna(order_type):
        return _badge("🟡 INCOMPLETE DATA", "#fff2b3")

    order_type = str(order_type).strip().upper()

    if order_type in {"BUY_LIMIT", "BUY_STOP"}:
        if order_price is None or pd.isna(order_price):
            return _badge("🟡 INCOMPLETE DATA", "#fff2b3")

    if order_type == "BUY_LIMIT":
        return _badge("🟢 PLACE BUY LIMIT", "#d4f8d4")
    if order_type == "BUY_STOP":
        return _badge("🔵 PLACE BUY STOP", "#d6e6ff")
    if order_type == "SKIP":
        return _badge("⚪ SKIP TRADE", "#e6e6e6")

    return _badge("🟡 INCOMPLETE DATA", "#fff2b3")


def _to_float_or_none(value: object) -> Optional[float]:
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if pd.isna(f):
        return None
    return f


def build_degiro_entry_lines(
    order_type: Optional[str],
    order_price: Optional[float],
    stop_price: Optional[float],
    band_low: Optional[float] = None,
    band_high: Optional[float] = None,
    validity: Optional[str] = None,
) -> list[str]:
    """
    Short, Degiro-friendly entry/stop lines for UI display.
    """
    lines: list[str] = []
    otype = str(order_type or "").strip().upper()
    price = _to_float_or_none(order_price)
    stop = _to_float_or_none(stop_price)
    low = _to_float_or_none(band_low)
    high = _to_float_or_none(band_high)
    valid = str(validity or "").strip().upper()

    if otype == "BUY_LIMIT" and price is not None:
        lines.append(f"Entry (Degiro: Limit): {price:.2f}")
    elif otype == "BUY_STOP" and price is not None:
        lines.append(f"Entry (Degiro: Stop Limit): stop {price:.2f}, limit {price:.2f}")
    elif otype and price is not None:
        lines.append(f"Entry ({otype}): {price:.2f}")

    if low is not None and high is not None:
        lines.append(f"Limit band: {low:.2f} - {high:.2f}")

    if stop is not None:
        lines.append(f"Stop-loss (Degiro: Stop Loss): {stop:.2f}")

    if valid:
        lines.append(f"Validity: {valid}")

    return lines


ORDER_COLUMNS = [
    "order_id",
    "ticker",
    "status",
    "order_kind",
    "order_type",
    "limit_price",
    "quantity",
    "stop_price",
    "order_date",
    "filled_date",
    "entry_price",
    "position_id",
    "parent_order_id",
    "tif",
    "notes",
]

def make_order_entry(
    ticker: str,
    order_type: str,
    limit_price: float,
    quantity: int,
    stop_price: Optional[float],
    notes: str = "",
    now: Optional[datetime] = None,
    order_kind: Optional[str] = None,
    parent_order_id: Optional[str] = None,
    position_id: Optional[str] = None,
    tif: Optional[str] = None,
) -> dict:
    ts = now or datetime.utcnow()
    order_id = f"{ticker}-{ts.strftime('%Y%m%d%H%M%S')}"
    order_date = ts.date().isoformat()
    return {
        "order_id": order_id,
        "ticker": ticker,
        "status": "pending",
        "order_kind": order_kind or "entry",
        "order_type": order_type,
        "limit_price": float(limit_price),
        "quantity": int(quantity),
        "stop_price": float(stop_price) if stop_price is not None else None,
        "order_date": order_date,
        "filled_date": "",
        "entry_price": None,
        "position_id": position_id,
        "parent_order_id": parent_order_id,
        "tif": tif or "GTC",
        "notes": notes.strip(),
    }


def load_orders(path: str | Path) -> list[dict]:
    p = Path(path)
    data = json.loads(p.read_text(encoding="utf-8"))
    out: list[dict] = []
    for idx, item in enumerate(data.get("orders", [])):
        ticker = str(item.get("ticker", "")).strip().upper()
        if not ticker:
            continue
        order_id = str(item.get("order_id", "")).strip() or f"{ticker}-{idx + 1}"
        status_raw = str(item.get("status", "pending")).strip().lower()
        status = status_raw if status_raw in {"pending", "filled", "cancelled"} else "pending"
        order_type = str(item.get("order_type", "")).strip().upper()
        order_kind_raw = str(item.get("order_kind", "")).strip().lower()
        if order_kind_raw in {"entry", "stop", "take_profit"}:
            order_kind = order_kind_raw
        else:
            if order_type.startswith("BUY_"):
                order_kind = "entry"
            elif order_type == "SELL_STOP":
                order_kind = "stop"
            elif order_type == "SELL_LIMIT":
                order_kind = "take_profit"
            else:
                order_kind = None

        out.append(
            {
                "order_id": order_id,
                "ticker": ticker,
                "status": status,
                "order_kind": order_kind,
                "order_type": order_type,
                "limit_price": item.get("limit_price", None),
                "quantity": item.get("quantity", None),
                "stop_price": item.get("stop_price", None),
                "order_date": str(item.get("order_date", "")).strip(),
                "filled_date": str(item.get("filled_date", "")).strip(),
                "entry_price": item.get("entry_price", None),
                "position_id": item.get("position_id", None),
                "parent_order_id": item.get("parent_order_id", None),
                "tif": item.get("tif", None) or "GTC",
                "notes": str(item.get("notes", "")).strip(),
            }
        )
    return out


def orders_to_dataframe(orders: list[dict]) -> pd.DataFrame:
    if not orders:
        return pd.DataFrame(columns=ORDER_COLUMNS)
    df = pd.DataFrame(orders)
    for col in ORDER_COLUMNS:
        if col not in df.columns:
            df[col] = None
    return df[ORDER_COLUMNS]


def save_orders(path: str | Path, orders: list[dict], asof: Optional[str] = None) -> None:
    p = Path(path)
    payload = {
        "asof": asof,
        "orders": orders,
    }
    ensure_parent_dir(p)
    p.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def orders_dicts_to_models(orders: list[dict]) -> list[Order]:
    out: list[Order] = []
    for item in orders:
        out.append(
            Order(
                order_id=str(item.get("order_id", "")).strip(),
                ticker=str(item.get("ticker", "")).strip().upper(),
                status=str(item.get("status", "pending")).strip().lower(),  # type: ignore[arg-type]
                order_type=str(item.get("order_type", "")).strip().upper(),
                quantity=int(item.get("quantity", 0) or 0),
                limit_price=(
                    float(item["limit_price"])
                    if item.get("limit_price") is not None
                    else None
                ),
                stop_price=(
                    float(item["stop_price"])
                    if item.get("stop_price") is not None
                    else None
                ),
                order_date=str(item.get("order_date", "")).strip(),
                filled_date=str(item.get("filled_date", "")).strip(),
                entry_price=(
                    float(item["entry_price"])
                    if item.get("entry_price") is not None
                    else None
                ),
                notes=str(item.get("notes", "")).strip(),
                order_kind=item.get("order_kind", None),
                parent_order_id=item.get("parent_order_id", None),
                position_id=item.get("position_id", None),
                tif=item.get("tif", None),
            )
        )
    return out


def orders_models_to_dicts(orders: list[Order]) -> list[dict]:
    out: list[dict] = []
    for o in orders:
        out.append(
            {
                "order_id": o.order_id,
                "ticker": o.ticker,
                "status": o.status,
                "order_kind": o.order_kind,
                "order_type": o.order_type,
                "limit_price": o.limit_price,
                "quantity": o.quantity,
                "stop_price": o.stop_price,
                "order_date": o.order_date,
                "filled_date": o.filled_date,
                "entry_price": o.entry_price,
                "position_id": o.position_id,
                "parent_order_id": o.parent_order_id,
                "tif": o.tif,
                "notes": o.notes,
            }
        )
    return out


def is_entry_order(order: dict) -> bool:
    order_kind = str(order.get("order_kind", "")).strip().lower()
    if order_kind:
        return order_kind == "entry"
    order_type = str(order.get("order_type", "")).strip().upper()
    return order_type.startswith("BUY_")
