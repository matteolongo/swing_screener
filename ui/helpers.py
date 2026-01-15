from __future__ import annotations

from pathlib import Path
from typing import Iterable, Optional
import json

import pandas as pd

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
                initial_risk=prev.initial_risk if prev else None,
                max_favorable_price=prev.max_favorable_price if prev else None,
                notes=str(notes) if notes is not None else "",
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
