from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, date
from pathlib import Path
from typing import Optional
import csv
import re

from swing_screener.execution.orders import Order, load_orders, save_orders


UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


@dataclass(frozen=True)
class DegiroFeeRow:
    broker_order_id: str
    fill_date: str
    fill_time: str
    quantity_signed: int
    fill_price: float
    value_eur: Optional[float]
    total_eur: Optional[float]
    fee_eur: float
    fx_rate: Optional[float]
    product: str


@dataclass(frozen=True)
class UnmatchedDegiroFee:
    broker_order_id: str
    fill_date: str
    quantity_signed: int
    fill_price: float
    fee_eur: float
    reason: str
    candidates: tuple[str, ...] = ()


@dataclass(frozen=True)
class DegiroFeeImportResult:
    total_csv_rows: int
    deduped_rows: int
    matched_rows: int
    unmatched_rows: int
    updated_orders: int
    unmatched: tuple[UnmatchedDegiroFee, ...]


@dataclass
class _FeeAggregate:
    fee_eur: float = 0.0
    fx_num: float = 0.0
    fx_den: float = 0.0

    def add(self, fee_eur: float, fx_rate: Optional[float], weight: Optional[float]) -> None:
        self.fee_eur += float(fee_eur)
        if fx_rate is None:
            return
        w = abs(float(weight)) if weight is not None else 1.0
        if w <= 0:
            w = 1.0
        self.fx_num += float(fx_rate) * w
        self.fx_den += w

    @property
    def fx_rate(self) -> Optional[float]:
        if self.fx_den <= 0:
            return None
        return self.fx_num / self.fx_den


def _to_float_comma(value: str) -> Optional[float]:
    text = str(value or "").strip()
    if not text:
        return None
    return float(text.replace(",", "."))


def _row_order_id(row: list[str]) -> str:
    # DeGiro exports can put the order id in an unlabeled trailing column.
    for candidate in reversed(row):
        c = str(candidate or "").strip()
        if UUID_RE.fullmatch(c):
            return c.lower()
    return ""


def _parse_rows(csv_path: str | Path) -> tuple[int, list[DegiroFeeRow]]:
    p = Path(csv_path)
    rows: list[DegiroFeeRow] = []
    total = 0
    with p.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.reader(fh)
        _ = next(reader, None)  # header
        for raw in reader:
            total += 1
            if len(raw) < 18:
                continue
            broker_order_id = _row_order_id(raw)
            if not broker_order_id:
                continue

            date_raw = str(raw[0]).strip()
            time_raw = str(raw[1]).strip()
            qty_raw = str(raw[6]).strip()
            price_raw = str(raw[7]).strip()
            if not date_raw or not qty_raw or not price_raw:
                continue

            try:
                fill_date = datetime.strptime(date_raw, "%d-%m-%Y").date().isoformat()
                quantity_signed = int(qty_raw)
                fill_price = float(price_raw.replace(",", "."))
            except ValueError:
                continue

            value_eur = _to_float_comma(raw[11])
            total_eur = _to_float_comma(raw[15])
            fx_rate = _to_float_comma(raw[12])
            fee_from_delta = None
            if value_eur is not None and total_eur is not None:
                fee_from_delta = abs(total_eur - value_eur)

            # Fallback for malformed rows where one of value/total is missing.
            fee_from_fields = abs(_to_float_comma(raw[13]) or 0.0) + abs(_to_float_comma(raw[14]) or 0.0)
            fee_eur = float(fee_from_delta if fee_from_delta is not None else fee_from_fields)

            rows.append(
                DegiroFeeRow(
                    broker_order_id=broker_order_id,
                    fill_date=fill_date,
                    fill_time=time_raw,
                    quantity_signed=quantity_signed,
                    fill_price=fill_price,
                    value_eur=value_eur,
                    total_eur=total_eur,
                    fee_eur=fee_eur,
                    fx_rate=fx_rate,
                    product=str(raw[2]).strip(),
                )
            )
    return total, rows


def _dedupe_rows(rows: list[DegiroFeeRow]) -> list[DegiroFeeRow]:
    deduped: dict[tuple, DegiroFeeRow] = {}
    for row in rows:
        key = (
            row.broker_order_id,
            row.fill_date,
            row.fill_time,
            row.quantity_signed,
            round(row.fill_price, 4),
            row.product,
        )
        current = deduped.get(key)
        if current is None:
            deduped[key] = row
            continue
        # Keep the row with the highest fee; in DeGiro duplicates this is typically the effective final row.
        if row.fee_eur > current.fee_eur + 1e-9:
            deduped[key] = row
            continue
        if abs(row.fee_eur - current.fee_eur) <= 1e-9 and row.fx_rate is not None and current.fx_rate is None:
            deduped[key] = row
    return list(deduped.values())


def _infer_order_side(order: Order) -> str:
    t = str(order.order_type or "").upper()
    k = str(order.order_kind or "").lower()
    if t.startswith("BUY_") or k == "entry":
        return "buy"
    if t.startswith("SELL_") or k in {"stop", "take_profit"}:
        return "sell"
    return "unknown"


def _find_matching_orders(
    row: DegiroFeeRow,
    orders: list[Order],
    *,
    price_tolerance: float,
) -> list[Order]:
    qty_abs = abs(int(row.quantity_signed))
    side = "buy" if row.quantity_signed > 0 else "sell"
    out: list[Order] = []
    for order in orders:
        if order.status != "filled":
            continue
        if str(order.filled_date) != row.fill_date:
            continue
        if int(order.quantity) != qty_abs:
            continue
        if order.entry_price is None:
            continue
        if abs(float(order.entry_price) - float(row.fill_price)) > price_tolerance:
            continue
        order_side = _infer_order_side(order)
        if order_side != "unknown" and order_side != side:
            continue
        out.append(order)
    return out


def import_degiro_fees_to_orders(
    orders_path: str | Path,
    csv_path: str | Path,
    *,
    price_tolerance: float = 0.02,
    apply_changes: bool = False,
) -> DegiroFeeImportResult:
    orders = load_orders(orders_path)
    total_rows, parsed_rows = _parse_rows(csv_path)
    deduped_rows = _dedupe_rows(parsed_rows)

    by_order_id = {o.order_id: o for o in orders}
    fee_updates: dict[str, _FeeAggregate] = {}
    unmatched: list[UnmatchedDegiroFee] = []
    matched_rows = 0

    for row in deduped_rows:
        target: Optional[Order] = None

        if row.broker_order_id in by_order_id:
            candidate = by_order_id[row.broker_order_id]
            if candidate.status == "filled":
                target = candidate

        if target is None:
            candidates = _find_matching_orders(row, orders, price_tolerance=price_tolerance)
            if len(candidates) == 1:
                target = candidates[0]
            elif len(candidates) > 1:
                unmatched.append(
                    UnmatchedDegiroFee(
                        broker_order_id=row.broker_order_id,
                        fill_date=row.fill_date,
                        quantity_signed=row.quantity_signed,
                        fill_price=row.fill_price,
                        fee_eur=row.fee_eur,
                        reason="ambiguous_match",
                        candidates=tuple(c.order_id for c in candidates),
                    )
                )
                continue
            else:
                unmatched.append(
                    UnmatchedDegiroFee(
                        broker_order_id=row.broker_order_id,
                        fill_date=row.fill_date,
                        quantity_signed=row.quantity_signed,
                        fill_price=row.fill_price,
                        fee_eur=row.fee_eur,
                        reason="no_match",
                    )
                )
                continue

        agg = fee_updates.setdefault(target.order_id, _FeeAggregate())
        agg.add(row.fee_eur, row.fx_rate, row.value_eur)
        matched_rows += 1

    updated_orders = 0
    if apply_changes and fee_updates:
        new_orders: list[Order] = []
        for order in orders:
            update = fee_updates.get(order.order_id)
            if update is None:
                new_orders.append(order)
                continue
            updated_orders += 1
            order.fee_eur = round(float(update.fee_eur), 4)
            fx_rate = update.fx_rate
            order.fill_fx_rate = round(float(fx_rate), 6) if fx_rate is not None else order.fill_fx_rate
            new_orders.append(order)
        save_orders(orders_path, new_orders, asof=str(date.today()))

    return DegiroFeeImportResult(
        total_csv_rows=total_rows,
        deduped_rows=len(deduped_rows),
        matched_rows=matched_rows,
        unmatched_rows=len(unmatched),
        updated_orders=updated_orders,
        unmatched=tuple(unmatched),
    )
