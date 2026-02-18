from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Optional
import json

from swing_screener.execution.degiro_fees import _parse_rows, _dedupe_rows, DegiroFeeRow
from swing_screener.execution.orders import Order, save_orders
from swing_screener.portfolio.state import Position, save_positions


@dataclass(frozen=True)
class BootstrapIssue:
    reason: str
    broker_order_id: str
    isin: str
    fill_date: str
    quantity_signed: int
    fill_price: float
    detail: str = ""


@dataclass(frozen=True)
class DegiroBootstrapResult:
    total_csv_rows: int
    deduped_rows: int
    orders_generated: int
    positions_generated: int
    open_positions: int
    closed_positions: int
    unresolved_isins: tuple[str, ...]
    issues: tuple[BootstrapIssue, ...]


@dataclass
class _OpenPositionState:
    position_id: str
    source_order_id: str
    entry_date: str
    entry_price: float
    shares: int
    stop_price: float
    max_favorable_price: float
    notes: str
    exit_order_ids: list[str] = field(default_factory=list)


def _load_isin_map(path: str | Path) -> dict[str, str]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("ISIN map must be a JSON object: {\"ISIN\": \"TICKER\"}")
    out: dict[str, str] = {}
    for k, v in payload.items():
        isin = str(k or "").strip().upper()
        ticker = str(v or "").strip().upper()
        if not isin or not ticker:
            continue
        out[isin] = ticker
    return out


def _order_id_for_row(row: DegiroFeeRow) -> str:
    return f"DGR-{row.broker_order_id.upper()}"


def _default_stop(entry_price: float) -> float:
    # DeGiro export does not include stops; set a conservative placeholder.
    return round(max(entry_price * 0.95, 0.01), 4)


def _next_position_id(ticker: str, entry_date: str, counters: dict[tuple[str, str], int]) -> str:
    key = (ticker, entry_date)
    counters[key] = counters.get(key, 0) + 1
    slug = entry_date.replace("-", "")
    return f"POS-{ticker}-{slug}-{counters[key]:02d}"


def bootstrap_orders_positions_from_degiro(
    *,
    csv_path: str | Path,
    isin_map_path: str | Path,
    orders_path: str | Path,
    positions_path: str | Path,
    apply_changes: bool = False,
) -> DegiroBootstrapResult:
    isin_map = _load_isin_map(isin_map_path)
    total_rows, parsed_rows = _parse_rows(csv_path)
    rows = sorted(_dedupe_rows(parsed_rows), key=lambda r: (r.fill_date, r.fill_time, r.broker_order_id))

    orders: list[Order] = []
    closed_positions: list[Position] = []
    open_by_ticker: dict[str, _OpenPositionState] = {}
    pos_counters: dict[tuple[str, str], int] = {}
    unresolved_isins: set[str] = set()
    issues: list[BootstrapIssue] = []

    for row in rows:
        ticker = isin_map.get(row.isin)
        if not ticker:
            unresolved_isins.add(row.isin)
            issues.append(
                BootstrapIssue(
                    reason="unresolved_isin",
                    broker_order_id=row.broker_order_id,
                    isin=row.isin,
                    fill_date=row.fill_date,
                    quantity_signed=row.quantity_signed,
                    fill_price=row.fill_price,
                    detail="Add this ISIN to the map file and re-run.",
                )
            )
            continue

        qty_signed = int(row.quantity_signed)
        qty_abs = abs(qty_signed)
        if qty_abs <= 0:
            continue

        order_id = _order_id_for_row(row)
        fee_eur = round(float(row.fee_eur), 4)
        fx_rate = round(float(row.fx_rate), 6) if row.fx_rate is not None else None

        if qty_signed > 0:
            order_kind = "entry"
            order_type = "BUY_MARKET"
            parent_order_id = None

            existing = open_by_ticker.get(ticker)
            if existing is None:
                pos_id = _next_position_id(ticker, row.fill_date, pos_counters)
                state = _OpenPositionState(
                    position_id=pos_id,
                    source_order_id=order_id,
                    entry_date=row.fill_date,
                    entry_price=float(row.fill_price),
                    shares=qty_abs,
                    stop_price=_default_stop(float(row.fill_price)),
                    max_favorable_price=float(row.fill_price),
                    notes="Imported from DeGiro transactions",
                )
                open_by_ticker[ticker] = state
            else:
                total_cost = existing.entry_price * existing.shares + float(row.fill_price) * qty_abs
                new_shares = existing.shares + qty_abs
                existing.entry_price = float(total_cost / new_shares)
                existing.shares = new_shares
                existing.max_favorable_price = max(existing.max_favorable_price, float(row.fill_price))
                state = existing

            orders.append(
                Order(
                    order_id=order_id,
                    ticker=ticker,
                    status="filled",
                    order_type=order_type,
                    quantity=qty_abs,
                    limit_price=None,
                    stop_price=None,
                    order_date=row.fill_date,
                    filled_date=row.fill_date,
                    entry_price=float(row.fill_price),
                    notes="Imported from DeGiro transactions",
                    order_kind=order_kind,
                    parent_order_id=parent_order_id,
                    position_id=state.position_id,
                    tif="GTC",
                    fee_eur=fee_eur,
                    fill_fx_rate=fx_rate,
                )
            )
            continue

        # Sell execution
        order_kind = "take_profit"
        order_type = "SELL_MARKET"
        state = open_by_ticker.get(ticker)
        linked_position_id: Optional[str] = None
        parent_order_id: Optional[str] = None

        if state is not None:
            linked_position_id = state.position_id
            parent_order_id = state.source_order_id
            state.exit_order_ids.append(order_id)

            if qty_abs > state.shares:
                issues.append(
                    BootstrapIssue(
                        reason="sell_exceeds_open_position",
                        broker_order_id=row.broker_order_id,
                        isin=row.isin,
                        fill_date=row.fill_date,
                        quantity_signed=row.quantity_signed,
                        fill_price=row.fill_price,
                        detail=f"Sell qty {qty_abs} > open shares {state.shares} for {ticker}; closing available shares only.",
                    )
                )
                qty_to_close = state.shares
            else:
                qty_to_close = qty_abs

            if qty_to_close == state.shares:
                closed_positions.append(
                    Position(
                        ticker=ticker,
                        status="closed",
                        position_id=state.position_id,
                        source_order_id=state.source_order_id,
                        entry_date=state.entry_date,
                        entry_price=float(state.entry_price),
                        stop_price=float(state.stop_price),
                        shares=int(state.shares),
                        initial_risk=round(float(state.entry_price - state.stop_price), 4),
                        max_favorable_price=float(state.max_favorable_price),
                        exit_date=row.fill_date,
                        exit_price=float(row.fill_price),
                        notes=state.notes,
                        exit_order_ids=list(state.exit_order_ids),
                    )
                )
                del open_by_ticker[ticker]
            else:
                state.shares -= qty_to_close
        else:
            issues.append(
                BootstrapIssue(
                    reason="sell_without_open_position",
                    broker_order_id=row.broker_order_id,
                    isin=row.isin,
                    fill_date=row.fill_date,
                    quantity_signed=row.quantity_signed,
                    fill_price=row.fill_price,
                    detail=f"No open position found for {ticker}; order kept unlinked.",
                )
            )

        orders.append(
            Order(
                order_id=order_id,
                ticker=ticker,
                status="filled",
                order_type=order_type,
                quantity=qty_abs,
                limit_price=None,
                stop_price=None,
                order_date=row.fill_date,
                filled_date=row.fill_date,
                entry_price=float(row.fill_price),
                notes="Imported from DeGiro transactions",
                order_kind=order_kind,
                parent_order_id=parent_order_id,
                position_id=linked_position_id,
                tif="GTC",
                fee_eur=fee_eur,
                fill_fx_rate=fx_rate,
            )
        )

    open_positions = [
        Position(
            ticker=ticker,
            status="open",
            position_id=state.position_id,
            source_order_id=state.source_order_id,
            entry_date=state.entry_date,
            entry_price=float(state.entry_price),
            stop_price=float(state.stop_price),
            shares=int(state.shares),
            initial_risk=round(float(state.entry_price - state.stop_price), 4),
            max_favorable_price=float(state.max_favorable_price),
            notes=state.notes,
            exit_order_ids=list(state.exit_order_ids) if state.exit_order_ids else None,
        )
        for ticker, state in sorted(open_by_ticker.items(), key=lambda item: item[0])
    ]

    positions = closed_positions + open_positions

    if apply_changes:
        today = str(date.today())
        save_orders(orders_path, orders, asof=today)
        save_positions(positions_path, positions, asof=today)

    return DegiroBootstrapResult(
        total_csv_rows=total_rows,
        deduped_rows=len(rows),
        orders_generated=len(orders),
        positions_generated=len(positions),
        open_positions=len(open_positions),
        closed_positions=len(closed_positions),
        unresolved_isins=tuple(sorted(unresolved_isins)),
        issues=tuple(issues),
    )
