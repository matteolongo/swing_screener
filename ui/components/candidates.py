from __future__ import annotations

import html
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from typing import Callable

import pandas as pd
import streamlit as st

from swing_screener.portfolio.state import load_positions
from ui.flows.quick_backtest import (
    build_bt_config_from_settings,
    run_quick_backtest_single,
)
from ui.helpers import (
    build_action_badge,
    build_degiro_entry_lines,
    ensure_parent_dir,
    is_entry_order,
    load_orders,
    make_order_entry,
    save_orders,
    write_last_run,
)


def _render_report_stats(report: pd.DataFrame) -> None:
    st.write(f"Rows: {len(report)}")
    if "signal" in report.columns:
        counts = report["signal"].value_counts()
        st.write("Signal breakdown:")
        st.write(counts)
        st.caption(
            "Signals guide which rows matter: "
            "breakout = price near breakout level (use suggested buy stop); "
            "pullback = price near short-term MA (use suggested buy limit); "
            "none = informational only (skip unless you change filters). "
            "Always follow the Suggested order type/price in the guidance table."
        )


def _badge_html(badge: dict) -> str:
    tooltip = badge.get("tooltip", "")
    tooltip_attr = f' title="{html.escape(tooltip)}"' if tooltip else ""
    return (
        f'<span style="background-color:{badge["bg_color"]}; '
        f'color:{badge["text_color"]}; padding:6px 10px; '
        f'border-radius:6px; font-weight:600; display:inline-block;"{tooltip_attr}>'
        f'{html.escape(badge["text"])}</span>'
    )


def render_candidates_tab(
    *,
    settings: dict,
    debug: bool,
    run_screener: Callable[..., tuple[pd.DataFrame, str | None]],
    handle_error: Callable[[Exception, bool], None],
    last_run_path: Path,
) -> None:
    st.subheader("1) Run screener and draft orders")
    st.info("Step 1: load data, see badges, and add pending orders directly from suggestions.")

    if st.button("Run screener", key="run_screener_btn"):
        try:
            report, report_csv = run_screener(
                settings["universe"],
                int(settings["top_n"]),
                float(settings["account_size"]),
                float(settings["risk_pct"]),
                float(settings["k_atr"]),
                float(settings["max_position_pct"]),
                bool(settings["use_cache"]),
                bool(settings["force_refresh"]),
                settings["report_path"],
                float(settings["min_price"]),
                float(settings["max_price"]),
                float(settings["max_atr_pct"]),
                bool(settings["require_trend_ok"]),
            )
            st.session_state["last_report"] = report
            st.session_state["last_report_csv"] = report_csv
            ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            write_last_run(last_run_path, ts)
            st.success("Screener complete. Scroll for guidance and order capture.")
        except Exception as e:
            handle_error(e, debug)

    report = st.session_state.get("last_report")
    report_csv = st.session_state.get("last_report_csv")

    if isinstance(report, pd.DataFrame) and not report.empty:
        st.caption("Showing up to 50 rows for a quick scan.")
        st.dataframe(report.head(50))
        _render_report_stats(report)
        with st.expander("Quick backtest", expanded=False):
            st.caption(
                "Run a quick backtest for any candidate using current backtest defaults. "
                "Choose the lookback window in months. "
                "Quick backtests use the sidebar stop distance (k*ATR) and quick max holding days. "
                "Results may be empty if the lookback windows exceed the available bars."
            )
            quick_bt_results = st.session_state.setdefault("quick_bt_results", {})
            month_end = datetime.utcnow().date()

            for idx, (ticker, row) in enumerate(report.head(50).iterrows()):
                ticker = str(ticker).strip().upper()
                signal = row.get("signal", "")
                order_type = row.get("suggested_order_type", "")
                cols = st.columns([1.2, 1.2, 1.5, 1.4, 1.1])
                with cols[0]:
                    st.write(ticker)
                with cols[1]:
                    st.write(signal)
                with cols[2]:
                    st.write(order_type)
                with cols[3]:
                    months_back = st.number_input(
                        "Lookback (months)",
                        min_value=1,
                        max_value=360,
                        value=int(st.session_state.get("bt_quick_months", 12)),
                        step=1,
                        key=f"bt_quick_months_{ticker}_{idx}",
                        label_visibility="visible",
                    )
                with cols[4]:
                    if st.button("Run backtest", key=f"bt_quick_{ticker}_{idx}"):
                        cfg_bt = build_bt_config_from_settings(settings)
                        max_hold_quick = int(settings.get("bt_quick_max_holding_days", 9999))
                        entry_type_override = None
                        order_type_norm = (
                            str(order_type).strip().upper() if order_type is not None else ""
                        )
                        signal_norm = str(signal).strip().lower() if signal is not None else ""
                        if order_type_norm == "BUY_STOP":
                            entry_type_override = "breakout"
                        elif order_type_norm == "BUY_LIMIT":
                            entry_type_override = "pullback"
                        elif signal_norm in {"breakout", "pullback"}:
                            entry_type_override = signal_norm
                        if entry_type_override:
                            cfg_bt = replace(cfg_bt, entry_type=entry_type_override)
                        cfg_bt = replace(
                            cfg_bt,
                            k_atr=float(settings.get("k_atr", cfg_bt.k_atr)),
                            max_holding_days=max_hold_quick,
                        )
                        month_start = (
                            pd.Timestamp(month_end) - pd.DateOffset(months=months_back)
                        ).date()
                        start_str = str(month_start)
                        end_str = str(month_end)
                        res_key = f"{ticker}|{months_back}"
                        with st.spinner(
                            f"Running backtest for {ticker} ({months_back} months)..."
                        ):
                            res = run_quick_backtest_single(
                                ticker,
                                cfg_bt,
                                start_str,
                                end_str,
                                bool(settings["use_cache"]),
                                bool(settings["force_refresh"]),
                            )
                        res["months_back"] = int(months_back)
                        quick_bt_results[res_key] = res
                        st.session_state["quick_bt_results"] = quick_bt_results

                res_key = f"{ticker}|{int(st.session_state.get(f'bt_quick_months_{ticker}_{idx}', 260))}"
                res = quick_bt_results.get(res_key)
                if res:
                    with st.expander(f"{ticker} — quick backtest results", expanded=False):
                        st.caption(
                            f"Window: {res['start']} → {res['end']} "
                            f"({res.get('months_back', '?')} months) | Bars: {res['bars']}"
                        )
                        for warn in res.get("warnings", []):
                            st.warning(warn)
                        st.dataframe(res["summary"], width="stretch")
                        trades = res.get("trades")
                        trade_count = int(len(trades)) if trades is not None else 0
                        total_r = (
                            float(trades["R"].sum())
                            if trades is not None and not trades.empty
                            else 0.0
                        )
                        try:
                            risk_per_trade = float(settings["account_size"]) * (
                                float(settings["risk_pct"]) / 100.0
                            )
                            total_eur = total_r * risk_per_trade
                        except Exception:
                            risk_per_trade = None
                            total_eur = None

                        cols_stats = st.columns(3)
                        cols_stats[0].metric("Trades (buys/sells)", f"{trade_count} / {trade_count}")
                        cols_stats[1].metric("Total P/L (R)", f"{total_r:.2f}R")
                        if total_eur is not None:
                            cols_stats[2].metric("Total P/L (€)", f"{total_eur:.2f}")
                        else:
                            cols_stats[2].metric("Total P/L (€)", "n/a")

                        curve = res.get("curve")
                        if curve is not None and not curve.empty:
                            st.line_chart(curve.set_index("date")[["cum_R"]])
                        else:
                            st.info("No equity curve to display.")
                        if trades is not None and not trades.empty:
                            st.dataframe(trades.head(200), width="stretch")
                        else:
                            st.info("No trades in this window.")

        guidance_cols = [
            "suggested_order_type",
            "suggested_order_price",
            "execution_note",
            "name",
            "currency",
            "exchange",
        ]
        if all(c in report.columns for c in guidance_cols):
            guidance = report[guidance_cols].copy()
            if "confidence" in report.columns:
                guidance["confidence"] = report["confidence"].map(
                    lambda x: f"{float(x):.1f}%" if pd.notna(x) else ""
                )
            if (
                "order_price_band_low" in report.columns
                and "order_price_band_high" in report.columns
            ):
                band = report[["order_price_band_low", "order_price_band_high"]].copy()
                guidance["order_price_band"] = band.apply(
                    lambda r: (
                        f"{float(r['order_price_band_low']):.2f} - "
                        f"{float(r['order_price_band_high']):.2f}"
                        if pd.notna(r["order_price_band_low"])
                        and pd.notna(r["order_price_band_high"])
                        else ""
                    ),
                    axis=1,
                )
            guidance["ui_action_badge"] = guidance.apply(build_action_badge, axis=1)

            display = guidance.copy()
            display.insert(0, "Action", display["ui_action_badge"].map(_badge_html))
            display = display.drop(columns=["ui_action_badge"])
            col_order = [
                "Action",
                "confidence",
                "name",
                "currency",
                "exchange",
                "suggested_order_type",
                "suggested_order_price",
                "execution_note",
                "order_price_band",
            ]
            existing_cols = [c for c in col_order if c in display.columns]
            rest = [c for c in display.columns if c not in existing_cols]
            display = display[existing_cols + rest]
            st.subheader("Execution guidance")
            st.caption(
                "Suggested order type/price comes from signal context: "
                "breakout → buy stop near breakout level; "
                "pullback → buy limit near pullback level; "
                "confidence shows signal quality (0-100); "
                "none → skip. "
                "Badges are hints only; orders are not placed automatically."
            )
            st.markdown(display.head(50).to_html(escape=False), unsafe_allow_html=True)

        with st.expander("Create pending orders from candidates", expanded=False):
            orders_file = Path(settings["orders_path"])
            if not orders_file.exists():
                st.warning(f"Orders file not found: {settings['orders_path']}")
                if st.button("Create orders.json", key="create_orders_template"):
                    ensure_parent_dir(orders_file)
                    orders_file.write_text('{"asof": null, "orders": []}\n', encoding="utf-8")
                    st.success("Template created.")
                    st.rerun()
            else:
                try:
                    orders = load_orders(settings["orders_path"])
                except Exception as e:
                    handle_error(e, debug)
                    orders = []

                try:
                    existing_positions = load_positions(settings["positions_path"])
                except Exception:
                    existing_positions = []

                order_rows = []
                for ticker, row in report.head(50).iterrows():
                    order_type = row.get("suggested_order_type", None)
                    order_price = row.get("suggested_order_price", None)
                    if order_type not in {"BUY_LIMIT", "BUY_STOP"}:
                        continue
                    order_rows.append((ticker, row, order_type, order_price))

                if not order_rows:
                    st.info("No actionable rows for order creation.")
                else:
                    st.subheader("Quick add from guidance")
                    st.caption(
                        "Click to create a pending order with suggested entry price, stop-loss, and shares. "
                        "If a ticker is already open, quick add creates a scale-in order (stop stays unchanged on fill). "
                        "Degiro terms: BUY_LIMIT = Limit, BUY_STOP = Stop Limit, stop-loss = Stop Loss."
                    )
                    cols = st.columns(min(3, len(order_rows)))
                    for idx, (ticker, row, order_type, order_price) in enumerate(order_rows):
                        col = cols[idx % len(cols)]
                        open_pos = next(
                            (
                                p
                                for p in existing_positions
                                if p.status == "open" and p.ticker == ticker
                            ),
                            None,
                        )
                        stop_price = (
                            float(open_pos.stop_price)
                            if open_pos is not None
                            else row.get("stop", None)
                        )
                        shares = row.get("shares", None)
                        has_open_position = open_pos is not None
                        has_existing_order = any(
                            o.get("ticker") == ticker
                            and o.get("status") in {"pending", "filled"}
                            and is_entry_order(o)
                            for o in orders
                        )
                        with col:
                            name = row.get("name", "") or ""
                            currency = row.get("currency", "") or ""
                            exchange = row.get("exchange", "") or ""
                            subtitle_parts = [p for p in [exchange, currency] if p]
                            subtitle = " | ".join(subtitle_parts)
                            st.markdown(f"**{ticker}** — {name or '—'}")
                            if subtitle:
                                st.caption(subtitle)
                            detail_lines = build_degiro_entry_lines(
                                order_type=order_type,
                                order_price=order_price,
                                stop_price=stop_price,
                                band_low=row.get("order_price_band_low", None),
                                band_high=row.get("order_price_band_high", None),
                                validity=row.get("suggested_validity", None),
                            )
                            if detail_lines:
                                st.markdown(detail_lines[0])
                                for line in detail_lines[1:]:
                                    st.caption(line)
                            else:
                                st.markdown(f"{order_type}")
                            disabled = has_existing_order
                            reason = None
                            if has_existing_order:
                                reason = "Pending/filled order exists."
                            label = f"Scale-in {ticker}" if has_open_position else f"Add {ticker}"
                            if st.button(label, key=f"quick_add_{ticker}", disabled=disabled):
                                orders.append(
                                    make_order_entry(
                                        ticker=ticker,
                                        order_type=order_type,
                                        limit_price=float(order_price),
                                        quantity=int(shares) if pd.notna(shares) else 1,
                                        stop_price=float(stop_price)
                                        if pd.notna(stop_price)
                                        else None,
                                        notes="from guidance (scale-in)"
                                        if has_open_position
                                        else "from guidance",
                                    )
                                )
                                save_orders(
                                    settings["orders_path"],
                                    orders,
                                    asof=str(pd.Timestamp.now().date()),
                                )
                                st.success(f"Order added: {ticker}")
                                st.rerun()
                            if reason:
                                st.caption(reason)
                            elif has_open_position:
                                st.caption(
                                    "Scale-in: blends entry/shares; stop stays unchanged on fill."
                                )

                    for ticker, row, order_type, order_price in order_rows:
                        open_pos = next(
                            (
                                p
                                for p in existing_positions
                                if p.status == "open" and p.ticker == ticker
                            ),
                            None,
                        )
                        stop_price = (
                            float(open_pos.stop_price)
                            if open_pos is not None
                            else row.get("stop", None)
                        )
                        shares = row.get("shares", None)
                        price_label = (
                            f"{float(order_price):.2f}" if pd.notna(order_price) else "n/a"
                        )
                        summary = f"{ticker} | {order_type} | {price_label}"
                        with st.expander(summary, expanded=False):
                            detail_lines = build_degiro_entry_lines(
                                order_type=order_type,
                                order_price=order_price,
                                stop_price=stop_price,
                                band_low=row.get("order_price_band_low", None),
                                band_high=row.get("order_price_band_high", None),
                                validity=row.get("suggested_validity", None),
                            )
                            if detail_lines:
                                st.markdown(detail_lines[0])
                                for line in detail_lines[1:]:
                                    st.caption(line)
                            form_key = f"order_form_{ticker}"
                            with st.form(form_key):
                                key_base = f"order_{ticker}"
                                order_type_sel = st.selectbox(
                                    "Order type",
                                    ["BUY_LIMIT", "BUY_STOP"],
                                    index=0 if order_type == "BUY_LIMIT" else 1,
                                    key=f"{key_base}_type",
                                )
                                price_label = (
                                    "Limit price"
                                    if order_type_sel == "BUY_LIMIT"
                                    else "Stop price (trigger)"
                                )
                                limit_price = st.number_input(
                                    price_label,
                                    min_value=0.01,
                                    value=float(order_price) if pd.notna(order_price) else 0.01,
                                    step=0.01,
                                    key=f"{key_base}_limit",
                                )
                                quantity = st.number_input(
                                    "Quantity",
                                    min_value=1,
                                    value=int(shares) if pd.notna(shares) else 1,
                                    step=1,
                                    key=f"{key_base}_qty",
                                )
                                stop_default = (
                                    f"{float(stop_price):.2f}" if pd.notna(stop_price) else ""
                                )
                                stop_price_input = st.text_input(
                                    "Stop-loss price (optional)",
                                    value=stop_default,
                                    key=f"{key_base}_stop",
                                )
                                notes = st.text_input(
                                    "Notes (optional)", key=f"{key_base}_notes"
                                )
                                submit_order = st.form_submit_button("Save pending order")

                            if submit_order:
                                if any(
                                    o.get("status") == "pending"
                                    and o.get("ticker") == ticker
                                    and is_entry_order(o)
                                    for o in orders
                                ):
                                    st.warning(f"{ticker}: pending order already exists.")
                                    continue

                                stop_price_value = None
                                if stop_price_input.strip():
                                    try:
                                        stop_price_value = float(stop_price_input.strip())
                                    except ValueError:
                                        st.error(f"{ticker}: stop price must be a number.")
                                        continue

                                orders.append(
                                    make_order_entry(
                                        ticker=ticker,
                                        order_type=order_type_sel,
                                        limit_price=float(limit_price),
                                        quantity=int(quantity),
                                        stop_price=stop_price_value,
                                        notes=notes,
                                    )
                                )
                                save_orders(
                                    settings["orders_path"],
                                    orders,
                                    asof=str(pd.Timestamp.now().date()),
                                )
                                st.success(f"Order added: {ticker}")
                                st.rerun()
        if report_csv:
            st.download_button(
                "Download report CSV",
                report_csv,
                file_name=Path(settings["report_path"]).name,
                mime="text/csv",
            )
    elif isinstance(report, pd.DataFrame):
        st.info("Report is empty. Try a different universe or rerun later.")
    else:
        st.info("Run the screener to see candidates and action badges.")
