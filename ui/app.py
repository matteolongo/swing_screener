from __future__ import annotations

import sys
from pathlib import Path
from datetime import datetime

import pandas as pd
import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from swing_screener.data.market_data import MarketDataConfig, fetch_ohlcv
from swing_screener.data.universe import UniverseConfig, load_universe_from_package
from swing_screener.reporting.report import ReportConfig, build_daily_report
from swing_screener.risk.position_sizing import RiskConfig
from swing_screener.portfolio.state import (
    load_positions,
    Position,
    evaluate_positions,
    updates_to_dataframe,
    apply_stop_updates,
    render_degiro_actions_md,
    save_positions,
    ManageConfig,
)
import html

from ui.helpers import (
    list_available_universes,
    ensure_parent_dir,
    load_positions_to_dataframe,
    dataframe_to_positions,
    safe_read_csv_preview,
    read_last_run,
    write_last_run,
    build_action_badge,
    load_orders,
    orders_to_dataframe,
    save_orders,
    make_order_entry,
)


def _handle_error(e: Exception, debug: bool) -> None:
    st.error(str(e))
    if debug:
        st.exception(e)


def _dedup_keep_order(items: list[str]) -> list[str]:
    out: list[str] = []
    for x in items:
        x = x.strip().upper()
        if x and x not in out:
            out.append(x)
    return out


def _run_screener(
    universe: str,
    top_n: int,
    account_size: float,
    risk_pct: float,
    use_cache: bool,
    force_refresh: bool,
    report_path: str,
) -> tuple[pd.DataFrame, str]:
    ucfg = UniverseConfig(benchmark="SPY", ensure_benchmark=True, max_tickers=top_n or None)
    tickers = load_universe_from_package(universe, ucfg)

    ohlcv = fetch_ohlcv(
        tickers,
        MarketDataConfig(),
        use_cache=use_cache,
        force_refresh=force_refresh,
    )

    rcfg = ReportConfig(
        risk=RiskConfig(
            account_size=account_size,
            risk_pct=risk_pct / 100.0,
            k_atr=2.0,
            max_position_pct=0.60,
        )
    )
    report = build_daily_report(ohlcv, rcfg)

    csv_text = report.to_csv(index=True)
    ensure_parent_dir(report_path)
    Path(report_path).write_text(csv_text, encoding="utf-8")

    return report, csv_text


def _run_manage(
    positions_path: str,
    edited_df: pd.DataFrame,
    apply_updates: bool,
    use_cache: bool,
    force_refresh: bool,
    manage_csv_path: str,
    md_path: str,
) -> tuple[pd.DataFrame, str]:
    existing_positions = load_positions(positions_path)
    positions = dataframe_to_positions(edited_df, existing_positions)

    open_tickers = [p.ticker for p in positions if p.status == "open"]
    if not open_tickers:
        save_positions(positions_path, positions, asof=str(pd.Timestamp.now().date()))
        return pd.DataFrame(), render_degiro_actions_md([])

    tickers = _dedup_keep_order(open_tickers)
    if "SPY" not in tickers:
        tickers.append("SPY")

    ohlcv = fetch_ohlcv(
        tickers,
        MarketDataConfig(),
        use_cache=use_cache,
        force_refresh=force_refresh,
    )

    updates, new_positions = evaluate_positions(ohlcv, positions, ManageConfig())

    if apply_updates:
        new_positions = apply_stop_updates(new_positions, updates)

    save_positions(positions_path, new_positions, asof=str(pd.Timestamp.now().date()))

    df = updates_to_dataframe(updates)
    ensure_parent_dir(manage_csv_path)
    df.to_csv(manage_csv_path)

    md_text = render_degiro_actions_md(updates)
    ensure_parent_dir(md_path)
    Path(md_path).write_text(md_text, encoding="utf-8")

    return df, md_text


def _render_report_stats(report: pd.DataFrame) -> None:
    st.write(f"Rows: {len(report)}")
    if "signal" in report.columns:
        counts = report["signal"].value_counts()
        st.write("Signal breakdown:")
        st.write(counts)


def main() -> None:
    st.set_page_config(page_title="Swing Screener UI", layout="wide")
    st.title("Swing Screener UI")

    universes = list_available_universes()
    if not universes:
        st.error("No universes found in package data.")
        st.stop()

    if "pending_page" in st.session_state:
        st.session_state["page"] = st.session_state.pop("pending_page")

    st.sidebar.header("Navigation")
    page = st.sidebar.radio(
        "Page",
        ["Daily Screener", "Manage Positions", "Orders", "Outputs"],
        key="page",
    )

    st.sidebar.header("Daily Routine")
    run_daily = st.sidebar.button("Run Daily Routine", type="primary")

    st.sidebar.header("Global")
    debug = st.sidebar.checkbox("Debug mode", value=False)

    with st.sidebar.expander("Screener settings", expanded=(page == "Daily Screener")):
        universe = st.selectbox("Universe", universes, index=0, key="universe")
        top_n = st.number_input("Top N (0 = no cap)", min_value=0, value=0, step=1, key="top_n")
        account_size = st.number_input(
            "Account size (EUR)", min_value=0.0, value=500.0, step=100.0, key="account_size"
        )
        risk_pct = st.number_input(
            "Risk %", min_value=0.1, max_value=5.0, value=1.0, step=0.1, key="risk_pct"
        )
        use_cache = st.checkbox("Use cache", value=True, key="use_cache")
        force_refresh = st.checkbox("Force refresh", value=False, key="force_refresh")
        report_path = st.text_input("Report CSV path", value="out/report.csv", key="report_path")

    with st.sidebar.expander("Manage settings", expanded=(page == "Manage Positions")):
        positions_path = st.text_input("Positions path", value="./positions.json", key="positions_path")
        apply_updates = st.checkbox("Apply stop updates to positions.json", value=False, key="apply_updates")
        manage_use_cache = st.checkbox("Use cache (manage)", value=True, key="manage_use_cache")
        manage_force_refresh = st.checkbox("Force refresh (manage)", value=False, key="manage_force_refresh")
        manage_csv_path = st.text_input("Manage CSV path", value="out/manage.csv", key="manage_csv_path")
        md_path = st.text_input("Degiro MD path", value="out/degiro_actions.md", key="md_path")

    with st.sidebar.expander("Orders settings", expanded=(page == "Orders")):
        orders_path = st.text_input("Orders path", value="./orders.json", key="orders_path")

    last_run_path = Path("ui/.last_run.json")

    if run_daily:
        try:
            report, report_csv = _run_screener(
                universe,
                int(top_n),
                float(account_size),
                float(risk_pct),
                bool(use_cache),
                bool(force_refresh),
                report_path,
            )
            st.session_state["last_report"] = report
            st.session_state["last_report_csv"] = report_csv
        except Exception as e:
            _handle_error(e, debug)

        try:
            positions_df = load_positions_to_dataframe(positions_path)
            df, md_text = _run_manage(
                positions_path,
                positions_df,
                bool(apply_updates),
                bool(manage_use_cache),
                bool(manage_force_refresh),
                manage_csv_path,
                md_path,
            )
            st.session_state["last_manage_df"] = df
            st.session_state["last_degiro_md"] = md_text
        except Exception as e:
            _handle_error(e, debug)

        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        write_last_run(last_run_path, ts)
        st.session_state["pending_page"] = "Outputs"
        st.rerun()

    if page == "Daily Screener":
        st.header("Daily Screener")
        if st.button("Run Screener"):
            try:
                report, report_csv = _run_screener(
                    universe,
                    int(top_n),
                    float(account_size),
                    float(risk_pct),
                    bool(use_cache),
                    bool(force_refresh),
                    report_path,
                )
                st.session_state["last_report"] = report
                st.session_state["last_report_csv"] = report_csv
                ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
                write_last_run(last_run_path, ts)
            except Exception as e:
                _handle_error(e, debug)

        report = st.session_state.get("last_report")
        report_csv = st.session_state.get("last_report_csv")
        if isinstance(report, pd.DataFrame) and not report.empty:
            st.dataframe(report.head(50))
            _render_report_stats(report)
            guidance_cols = [
                "suggested_order_type",
                "suggested_order_price",
                "execution_note",
            ]
            if all(c in report.columns for c in guidance_cols):
                guidance = report[guidance_cols].copy()
                if "order_price_band_low" in report.columns and "order_price_band_high" in report.columns:
                    band = report[["order_price_band_low", "order_price_band_high"]].copy()
                    guidance["order_price_band"] = band.apply(
                        lambda r: (
                            f"{float(r['order_price_band_low']):.2f} - {float(r['order_price_band_high']):.2f}"
                            if pd.notna(r["order_price_band_low"]) and pd.notna(r["order_price_band_high"])
                            else ""
                        ),
                        axis=1,
                    )
                guidance["ui_action_badge"] = guidance.apply(build_action_badge, axis=1)

                def _badge_html(badge: dict) -> str:
                    tooltip = badge.get("tooltip", "")
                    tooltip_attr = f' title="{html.escape(tooltip)}"' if tooltip else ""
                    return (
                        f'<span style="background-color:{badge["bg_color"]}; '
                        f'color:{badge["text_color"]}; padding:6px 10px; '
                        f'border-radius:6px; font-weight:600; display:inline-block;"{tooltip_attr}>'
                        f'{html.escape(badge["text"])}</span>'
                    )

                display = guidance.copy()
                display.insert(0, "Action", display["ui_action_badge"].map(_badge_html))
                display = display.drop(columns=["ui_action_badge"])
                st.subheader("Execution guidance")
                st.markdown(display.head(50).to_html(escape=False), unsafe_allow_html=True)

            st.subheader("Create pending orders")
            orders_file = Path(orders_path)
            if not orders_file.exists():
                st.warning(f"Orders file not found: {orders_path}")
                if st.button("Create orders.json"):
                    ensure_parent_dir(orders_file)
                    orders_file.write_text('{"asof": null, "orders": []}\n', encoding="utf-8")
                    st.success("Template created.")
                    st.rerun()
            else:
                try:
                    orders = load_orders(orders_path)
                except Exception as e:
                    _handle_error(e, debug)
                    orders = []

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
                    for ticker, row, order_type, order_price in order_rows:
                        stop_price = row.get("stop", None)
                        shares = row.get("shares", None)
                        summary = f"{ticker} | {order_type} | {float(order_price):.2f}"
                        with st.expander(summary, expanded=False):
                            form_key = f"order_form_{ticker}"
                            with st.form(form_key):
                                key_base = f"order_{ticker}"
                                order_type_sel = st.selectbox(
                                    "Order type",
                                    ["BUY_LIMIT", "BUY_STOP"],
                                    index=0 if order_type == "BUY_LIMIT" else 1,
                                    key=f"{key_base}_type",
                                )
                                limit_price = st.number_input(
                                    "Limit/Stop price",
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
                                    "Stop price (optional)",
                                    value=stop_default,
                                    key=f"{key_base}_stop",
                                )
                                notes = st.text_input("Notes (optional)", key=f"{key_base}_notes")
                                submit_order = st.form_submit_button("Save pending order")

                            if submit_order:
                                if any(
                                    o.get("status") == "pending" and o.get("ticker") == ticker
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
                                save_orders(orders_path, orders, asof=str(pd.Timestamp.now().date()))
                                st.success(f"Order added: {ticker}")
                                st.rerun()
            st.download_button(
                "Download report CSV",
                report_csv,
                file_name=Path(report_path).name,
                mime="text/csv",
            )
        elif isinstance(report, pd.DataFrame):
            st.info("Report is empty.")

    if page == "Manage Positions":
        st.header("Manage Positions")
        positions_file = Path(positions_path)
        if not positions_file.exists():
            st.error(f"Positions file not found: {positions_path}")
            if st.button("Create template positions.json"):
                ensure_parent_dir(positions_file)
                positions_file.write_text(
                    '{"asof": null, "positions": []}\n', encoding="utf-8"
                )
                st.success("Template created.")
            st.stop()

        try:
            positions_df = load_positions_to_dataframe(positions_path)
        except Exception as e:
            _handle_error(e, debug)
            st.stop()

        if positions_df.empty:
            positions_df = pd.DataFrame(
                columns=[
                    "ticker",
                    "status",
                    "entry_date",
                    "entry_price",
                    "stop_price",
                    "shares",
                    "notes",
                ]
            )

        edited_df = st.data_editor(
            positions_df,
            num_rows="dynamic",
            width="stretch",
        )

        if st.button("Manage"):
            try:
                df, md_text = _run_manage(
                    positions_path,
                    edited_df,
                    bool(apply_updates),
                    bool(manage_use_cache),
                    bool(manage_force_refresh),
                    manage_csv_path,
                    md_path,
                )
                st.session_state["last_manage_df"] = df
                st.session_state["last_degiro_md"] = md_text
                ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
                write_last_run(last_run_path, ts)
            except Exception as e:
                _handle_error(e, debug)

        df = st.session_state.get("last_manage_df")
        md_text = st.session_state.get("last_degiro_md")
        if isinstance(df, pd.DataFrame):
            if df.empty:
                st.info("No management actions.")
            else:
                display = df.copy()
                display = display.rename(
                    columns={
                        "action": "Action",
                        "last": "Last Price",
                        "entry": "Entry Price",
                        "stop_old": "Stop (old)",
                        "stop_suggested": "Stop (suggested)",
                        "r_now": "R now",
                        "reason": "Reason",
                        "shares": "Shares",
                    }
                )
                st.caption("R now = (last - entry) / (entry - stop). It shows current profit in R units.")
                st.dataframe(display, width="stretch")
                st.download_button(
                    "Download manage CSV",
                    df.to_csv(index=True),
                    file_name=Path(manage_csv_path).name,
                    mime="text/csv",
                )
        if isinstance(md_text, str) and md_text:
            st.markdown(md_text)
            st.download_button(
                "Download Degiro checklist",
                md_text,
                file_name=Path(md_path).name,
                mime="text/markdown",
            )

    if page == "Orders":
        st.header("Orders")
        orders_file = Path(orders_path)
        if not orders_file.exists():
            st.error(f"Orders file not found: {orders_path}")
            if st.button("Create template orders.json"):
                ensure_parent_dir(orders_file)
                orders_file.write_text('{"asof": null, "orders": []}\n', encoding="utf-8")
                st.success("Template created.")
            st.stop()

        try:
            orders = load_orders(orders_path)
        except Exception as e:
            _handle_error(e, debug)
            st.stop()

        st.subheader("Place order")
        with st.form("place_order"):
            ticker = st.text_input("Ticker").strip().upper()
            order_type = st.selectbox("Order type", ["BUY_LIMIT", "BUY_STOP"])
            limit_price = st.number_input("Limit/Stop price", min_value=0.01, value=0.01, step=0.01)
            quantity = st.number_input("Quantity", min_value=1, value=1, step=1)
            stop_price_raw = st.text_input("Stop price (optional)")
            notes = st.text_input("Notes (optional)")
            submitted = st.form_submit_button("Add pending order")

        if submitted:
            if not ticker:
                st.error("Ticker is required.")
                st.stop()
            stop_price = None
            if stop_price_raw.strip():
                try:
                    stop_price = float(stop_price_raw.strip())
                except ValueError:
                    st.error("Stop price must be a number.")
                    st.stop()
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
            save_orders(orders_path, orders, asof=str(pd.Timestamp.now().date()))
            st.success(f"Order added: {ticker}")
            st.rerun()

        orders_df = orders_to_dataframe(orders)
        pending_df = orders_df[orders_df["status"] == "pending"].copy()

        st.subheader("Pending orders")
        if pending_df.empty:
            st.info("No pending orders.")
        else:
            st.dataframe(pending_df, width="stretch")

        st.subheader("Update pending order")
        pending = [o for o in orders if o.get("status") == "pending"]
        if not pending:
            st.info("No pending orders to update.")
        else:
            options = {
                f"{o['ticker']} | {o['order_type']} | {o['order_id']}": o["order_id"]
                for o in pending
            }
            with st.form("update_order"):
                selection = st.selectbox("Pending order", list(options.keys()))
                selected_id = options[selection]
                selected = next(o for o in pending if o["order_id"] == selected_id)
                default_entry = float(selected.get("limit_price") or 0.0)
                fill_price = st.number_input(
                    "Fill price (default = limit price)",
                    min_value=0.01,
                    value=default_entry if default_entry > 0 else 0.01,
                    step=0.01,
                )
                fill_date = st.date_input(
                    "Fill date",
                    value=datetime.utcnow().date(),
                )
                quantity_input = st.number_input(
                    "Quantity",
                    min_value=1,
                    value=int(selected.get("quantity") or 1),
                    step=1,
                )
                stop_price_input = st.text_input(
                    "Stop price (required to mark filled)",
                    value=(
                        f"{float(selected.get('stop_price')):.2f}"
                        if selected.get("stop_price") is not None
                        else ""
                    ),
                )
                action = st.radio("Action", ["Mark filled", "Mark cancelled"])
                update_submit = st.form_submit_button("Update order")

            if update_submit:
                had_error = False
                for order in orders:
                    if order.get("order_id") != selected_id:
                        continue
                    if action == "Mark cancelled":
                        order["status"] = "cancelled"
                        order["filled_date"] = ""
                        order["entry_price"] = None
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

                        positions = load_positions(positions_path)
                        if any(
                            p.status == "open" and p.ticker == order["ticker"] for p in positions
                        ):
                            st.error(
                                f"{order['ticker']}: already an open position. Close it or cancel the order."
                            )
                            had_error = True
                            break

                        order["quantity"] = int(quantity_input)
                        order["stop_price"] = float(stop_price_value)
                        order["status"] = "filled"
                        order["filled_date"] = str(fill_date)
                        order["entry_price"] = float(fill_price)

                        positions.append(
                            Position(
                                ticker=order["ticker"],
                                status="open",
                                entry_date=str(fill_date),
                                entry_price=float(fill_price),
                                stop_price=float(order["stop_price"]),
                                shares=int(order["quantity"]),
                                initial_risk=None,
                                max_favorable_price=float(fill_price),
                                notes=str(order.get("notes", "")),
                            )
                        )
                        save_positions(positions_path, positions, asof=str(pd.Timestamp.now().date()))
                    break

                if not had_error:
                    save_orders(orders_path, orders, asof=str(pd.Timestamp.now().date()))
                    st.success("Order updated.")
                    st.rerun()

        st.subheader("All orders")
        if orders_df.empty:
            st.info("No orders recorded.")
        else:
            st.dataframe(orders_df, width="stretch")

    if page == "Outputs":
        st.header("Outputs")
        last_run = read_last_run(last_run_path)
        if last_run:
            st.write(f"Last run: {last_run}")

        report_df, report_err = safe_read_csv_preview(report_path)
        if report_err:
            st.warning(f"Unable to read report CSV: {report_err}")
        elif not report_df.empty:
            st.subheader("Report preview")
            st.dataframe(report_df, width="stretch")

        md_file = Path(md_path)
        if md_file.exists():
            st.subheader("Degiro actions")
            st.markdown(md_file.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
