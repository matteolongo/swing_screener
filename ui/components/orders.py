from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Callable

import pandas as pd
import streamlit as st

from swing_screener.execution.orders_service import (
    fill_entry_order_dicts,
    scale_in_fill_dicts,
)
from swing_screener.portfolio.state import load_positions, save_positions
from ui.helpers import (
    ensure_parent_dir,
    load_orders,
    make_order_entry,
    orders_to_dataframe,
    save_orders,
)


def render_orders_tab(
    *,
    settings: dict,
    debug: bool,
    handle_error: Callable[[Exception, bool], None],
) -> None:
    st.subheader("2) Orders")
    st.info("Review pending orders, add manual ones, and mark fills. Filled orders become positions.")

    orders_file = Path(settings["orders_path"])
    orders: list[dict] = []
    if not orders_file.exists():
        st.warning(f"Orders file not found: {settings['orders_path']}")
        if st.button("Create template orders.json", key="create_orders_template_orders_tab"):
            ensure_parent_dir(orders_file)
            orders_file.write_text('{"asof": null, "orders": []}\n', encoding="utf-8")
            st.success("Template created.")
    try:
        orders = load_orders(settings["orders_path"])
    except Exception as e:
        handle_error(e, debug)
        orders = []
    try:
        positions = load_positions(settings["positions_path"])
    except Exception:
        positions = []

    st.caption("Add a manual pending order")
    with st.form("place_order"):
        ticker = st.text_input("Ticker").strip().upper()
        order_type = st.selectbox("Order type", ["BUY_LIMIT", "BUY_STOP"])
        price_label = "Limit price" if order_type == "BUY_LIMIT" else "Stop price (trigger)"
        limit_price = st.number_input(price_label, min_value=0.01, value=0.01, step=0.01)
        quantity = st.number_input("Quantity", min_value=1, value=1, step=1)
        stop_price_raw = st.text_input("Stop-loss price (optional)")
        notes = st.text_input("Notes (optional)")
        submitted = st.form_submit_button("Add pending order")

    if submitted:
        stop_price = None
        valid = True
        if not ticker:
            st.error("Ticker is required.")
            valid = False
        else:
            if stop_price_raw.strip():
                try:
                    stop_price = float(stop_price_raw.strip())
                except ValueError:
                    st.error("Stop price must be a number.")
                    valid = False
            if valid:
                orders.append(
                    make_order_entry(
                        ticker=ticker,
                        order_type=order_type,
                        limit_price=float(limit_price),
                        quantity=int(quantity),
                        stop_price=stop_price,
                        notes=notes,
                    )
                )
                save_orders(settings["orders_path"], orders, asof=str(pd.Timestamp.now().date()))
                st.success(f"Order added: {ticker}")
                st.rerun()

    orders_df = orders_to_dataframe(orders)
    pending_df = orders_df[orders_df["status"] == "pending"].copy()

    st.subheader("Pending orders")
    if pending_df.empty:
        st.info("No pending orders.")
    else:
        st.dataframe(pending_df, width="stretch")

    linked_df = orders_df[orders_df["position_id"].notna()].copy()
    st.subheader("Linked orders (by position)")
    if linked_df.empty:
        st.info("No linked orders yet.")
    else:
        linked_df = linked_df.sort_values(["position_id", "order_kind", "order_date"])
        for position_id, group in linked_df.groupby("position_id"):
            with st.expander(f"{position_id} ({len(group)} orders)", expanded=False):
                cols = [
                    "order_id",
                    "ticker",
                    "order_kind",
                    "order_type",
                    "status",
                    "limit_price",
                    "stop_price",
                    "quantity",
                    "parent_order_id",
                    "order_date",
                    "filled_date",
                    "tif",
                    "notes",
                ]
                display = group[[c for c in cols if c in group.columns]]
                st.dataframe(display, width="stretch")

    st.subheader("Update pending order")
    pending = [o for o in orders if o.get("status") == "pending"]
    if not pending:
        st.info("No pending orders to update.")
    else:
        for pending_order in pending:
            oid = pending_order.get("order_id")
            order_kind = str(pending_order.get("order_kind") or "entry").strip().lower()
            position_id = pending_order.get("position_id", None)
            open_pos = None
            if order_kind == "entry":
                open_pos = next(
                    (
                        p
                        for p in positions
                        if p.status == "open" and p.ticker == pending_order["ticker"]
                    ),
                    None,
                )
            kind_label = order_kind or "entry"
            header = f"{pending_order['ticker']} | {pending_order['order_type']} | {kind_label}"
            if position_id:
                header = f"{header} | {position_id}"
            with st.expander(header, expanded=False):
                form_key = f"update_{oid}"
                with st.form(form_key):
                    order_type_raw = str(pending_order.get("order_type", "")).strip().upper()
                    order_kind_raw = str(pending_order.get("order_kind", "")).strip().lower()
                    if order_kind_raw == "stop" or order_type_raw == "SELL_STOP":
                        default_entry = float(pending_order.get("stop_price") or 0.0)
                    else:
                        default_entry = float(pending_order.get("limit_price") or 0.0)
                    order_price_input = st.number_input(
                        "Order price (pending) / Fill price (filled)",
                        min_value=0.01,
                        value=default_entry if default_entry > 0 else 0.01,
                        step=0.01,
                        key=f"{form_key}_fill_price",
                    )
                    fill_date = st.date_input(
                        "Fill date",
                        value=datetime.utcnow().date(),
                        key=f"{form_key}_date",
                    )
                    quantity_input = st.number_input(
                        "Quantity",
                        min_value=1,
                        value=int(pending_order.get("quantity") or 1),
                        step=1,
                        key=f"{form_key}_qty",
                    )
                    stop_price_input = st.text_input(
                        "Stop-loss price (required to mark filled)",
                        value=(
                            f"{float(pending_order.get('stop_price')):.2f}"
                            if pending_order.get("stop_price") is not None
                            else ""
                        ),
                        key=f"{form_key}_stop",
                    )
                    tp_price_input = st.text_input(
                        "Take profit price (optional)",
                        value="",
                        key=f"{form_key}_tp",
                    )
                    if order_kind == "entry":
                        if open_pos:
                            action_options = [
                                "Save pending changes",
                                "Scale-in (mark filled)",
                                "Mark cancelled",
                            ]
                            pos_id_label = open_pos.position_id or "no position_id"
                            st.caption(
                                f"Open position detected ({pos_id_label}). Scale-in blends entry/shares; "
                                f"stop stays at {float(open_pos.stop_price):.2f}."
                            )
                        else:
                            action_options = ["Save pending changes", "Mark filled", "Mark cancelled"]
                    else:
                        action_options = ["Save pending changes", "Mark cancelled"]
                        st.caption("Exit orders are linked to positions; mark filled in positions.json.")
                    action = st.radio("Action", action_options, key=f"{form_key}_action")
                    update_submit = st.form_submit_button("Update order")

                if update_submit:
                    had_error = False
                    if action in {"Mark filled", "Scale-in (mark filled)"} and order_kind != "entry":
                        st.error("Only entry orders can be marked filled here.")
                        continue
                    for order in orders:
                        if order.get("order_id") != oid:
                            continue
                        if action == "Mark cancelled":
                            order["status"] = "cancelled"
                            order["filled_date"] = ""
                            order["entry_price"] = None
                        elif action == "Save pending changes":
                            order_kind_live = str(order.get("order_kind", "")).strip().lower()
                            order_type_live = str(order.get("order_type", "")).strip().upper()
                            if order_kind_live == "stop" or order_type_live == "SELL_STOP":
                                order["stop_price"] = float(order_price_input)
                                order["limit_price"] = None
                            elif order_kind_live == "take_profit" or order_type_live == "SELL_LIMIT":
                                order["limit_price"] = float(order_price_input)
                                order["stop_price"] = None
                            else:
                                order["limit_price"] = float(order_price_input)
                                order["stop_price"] = (
                                    float(stop_price_input.strip())
                                    if stop_price_input.strip()
                                    else None
                                )
                            order["quantity"] = int(quantity_input)
                            order["notes"] = pending_order.get("notes", "")
                            order["status"] = "pending"
                        elif action == "Scale-in (mark filled)":
                            fill_price = float(order_price_input)
                            add_shares = int(quantity_input)
                            try:
                                orders, positions = scale_in_fill_dicts(
                                    orders,
                                    positions,
                                    order_id=oid,
                                    fill_price=fill_price,
                                    fill_date=str(fill_date),
                                    quantity=add_shares,
                                )
                            except ValueError as e:
                                st.error(f"{order['ticker']}: {e}")
                                had_error = True
                                break

                            save_positions(
                                settings["positions_path"],
                                positions,
                                asof=str(pd.Timestamp.now().date()),
                            )
                        else:
                            if stop_price_input.strip() == "":
                                st.error(f"{order['ticker']}: stop price required to mark filled.")
                                had_error = True
                                break
                            try:
                                stop_price_value = float(stop_price_input.strip())
                            except ValueError:
                                st.error(f"{order['ticker']}: stop price must be a number.")
                                had_error = True
                                break
                            fill_price = float(order_price_input)
                            if stop_price_value >= fill_price:
                                st.error(
                                    f"{order['ticker']}: stop loss must be below entry price."
                                )
                                had_error = True
                                break
                            tp_price_value = None
                            if tp_price_input.strip():
                                try:
                                    tp_price_value = float(tp_price_input.strip())
                                except ValueError:
                                    st.error(
                                        f"{order['ticker']}: take profit must be a number."
                                    )
                                    had_error = True
                                    break

                            try:
                                orders, positions = fill_entry_order_dicts(
                                    orders,
                                    positions,
                                    order_id=oid,
                                    fill_price=float(fill_price),
                                    fill_date=str(fill_date),
                                    quantity=int(quantity_input),
                                    stop_price=float(stop_price_value),
                                    tp_price=tp_price_value,
                                )
                            except ValueError as e:
                                st.error(f"{order['ticker']}: {e}")
                                had_error = True
                                break

                            save_positions(
                                settings["positions_path"],
                                positions,
                                asof=str(pd.Timestamp.now().date()),
                            )
                        break

                    if not had_error:
                        save_orders(settings["orders_path"], orders, asof=str(pd.Timestamp.now().date()))
                        st.success("Order updated.")
                        st.rerun()

    st.subheader("All orders")
    if orders_df.empty:
        st.info("No orders recorded.")
    else:
        st.dataframe(orders_df, width="stretch")
