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
from swing_screener.screeners.ranking import RankingConfig
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
    load_user_defaults,
    save_user_defaults,
)

PREFS_PATH = Path("ui/.user_defaults.json")
LAST_RUN_PATH = Path("ui/.last_run.json")

DEFAULT_SETTINGS: dict = {
    "universe": "mega",
    "top_n": 0,  # 0 = no cap (use full universe)
    "account_size": 500.0,
    "risk_pct": 1.0,
    "use_cache": True,
    "force_refresh": False,
    "report_path": "out/report.csv",
    "positions_path": "./positions.json",
    "orders_path": "./orders.json",
    "apply_updates": False,
    "manage_use_cache": True,
    "manage_force_refresh": False,
    "manage_csv_path": "out/manage.csv",
    "md_path": "out/degiro_actions.md",
}


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

    ranking_top_n = top_n if top_n and top_n > 0 else 10_000  # 0 = no cap in UI -> effectively all

    ohlcv = fetch_ohlcv(
        tickers,
        MarketDataConfig(),
        use_cache=use_cache,
        force_refresh=force_refresh,
    )

    rcfg = ReportConfig(
        ranking=RankingConfig(top_n=ranking_top_n),
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


def _init_settings(universes: list[str]) -> dict:
    stored = load_user_defaults(PREFS_PATH)
    defaults = {**DEFAULT_SETTINGS, **stored}
    if universes:
        defaults["universe"] = defaults["universe"] if defaults["universe"] in universes else universes[0]

    for key, value in defaults.items():
        st.session_state.setdefault(key, value)

    return defaults


def _current_settings() -> dict:
    keys = [
        "universe",
        "top_n",
        "account_size",
        "risk_pct",
        "use_cache",
        "force_refresh",
        "report_path",
        "positions_path",
        "orders_path",
        "apply_updates",
        "manage_use_cache",
        "manage_force_refresh",
        "manage_csv_path",
        "md_path",
    ]
    return {k: st.session_state.get(k) for k in keys}


def main() -> None:
    st.set_page_config(page_title="Swing Screener UI", layout="wide")
    st.title("Swing Screener — Daily dashboard")
    st.caption("Beginner-friendly flow: run screener → draft orders → manage open trades → review outputs.")

    universes = list_available_universes()
    if not universes:
        st.error("No universes found in package data.")
        st.stop()

    defaults = _init_settings(universes)

    st.sidebar.header("Session settings")
    st.sidebar.caption("Values here drive every step. Save once, reuse daily.")
    with st.sidebar.form("settings_form"):
        universe = st.selectbox(
            "Universe",
            universes,
            index=universes.index(st.session_state["universe"]),
            key="universe",
            help="Pick the ticker list to scan (default: mega).",
        )
        top_n = st.slider(
            "Top N (0 = all)",
            min_value=0,
            max_value=200,
            value=int(st.session_state.get("top_n", defaults["top_n"])),
            step=10,
            key="top_n",
            help="Limit how many candidates you review. Lower = faster and simpler.",
        )
        account_size = st.number_input(
            "Account size (EUR)",
            min_value=100.0,
            value=float(st.session_state.get("account_size", defaults["account_size"])),
            step=500.0,
            key="account_size",
        )
        risk_pct = st.slider(
            "Risk per trade (%)",
            min_value=0.5,
            max_value=2.0,
            value=float(st.session_state.get("risk_pct", defaults["risk_pct"])),
            step=0.1,
            key="risk_pct",
            help="Keep between 0.5% and 2% to stay conservative.",
        )
        st.caption("Data options")
        use_cache = st.checkbox(
            "Use cached data",
            value=bool(st.session_state.get("use_cache", defaults["use_cache"])),
            key="use_cache",
        )
        force_refresh = st.checkbox(
            "Force refresh data",
            value=bool(st.session_state.get("force_refresh", defaults["force_refresh"])),
            key="force_refresh",
        )
        st.caption("Paths")
        report_path = st.text_input("Report CSV path", value=st.session_state["report_path"], key="report_path")
        positions_path = st.text_input("Positions path", value=st.session_state["positions_path"], key="positions_path")
        orders_path = st.text_input("Orders path", value=st.session_state["orders_path"], key="orders_path")
        manage_csv_path = st.text_input("Manage CSV path", value=st.session_state["manage_csv_path"], key="manage_csv_path")
        md_path = st.text_input("Degiro checklist path", value=st.session_state["md_path"], key="md_path")
        apply_updates = st.checkbox(
            "Apply stop updates to positions.json",
            value=bool(st.session_state.get("apply_updates", defaults["apply_updates"])),
            key="apply_updates",
            help="When enabled, stop raises will be written automatically (never lowered).",
        )
        manage_use_cache = st.checkbox(
            "Use cached data (manage)",
            value=bool(st.session_state.get("manage_use_cache", defaults["manage_use_cache"])),
            key="manage_use_cache",
        )
        manage_force_refresh = st.checkbox(
            "Force refresh data (manage)",
            value=bool(st.session_state.get("manage_force_refresh", defaults["manage_force_refresh"])),
            key="manage_force_refresh",
        )
        save_defaults = st.form_submit_button("Save as my defaults")

    st.sidebar.header("Utilities")
    debug = st.sidebar.checkbox("Debug mode", value=False)
    if save_defaults:
        save_user_defaults(PREFS_PATH, _current_settings())
        st.sidebar.success("Defaults saved for next sessions.")

    st.markdown(
        """
        **Quick tips**
        - Run after US market close, once per day.
        - Follow the steps left-to-right. Green/blue badges mean actionable orders.
        - Keep risk % modest; avoid changing stops downward.
        """
    )

    run_daily = st.button("Run daily routine (screener + manage)", type="primary")

    settings = _current_settings()

    if run_daily:
        try:
            report, report_csv = _run_screener(
                settings["universe"],
                int(settings["top_n"]),
                float(settings["account_size"]),
                float(settings["risk_pct"]),
                bool(settings["use_cache"]),
                bool(settings["force_refresh"]),
                settings["report_path"],
            )
            st.session_state["last_report"] = report
            st.session_state["last_report_csv"] = report_csv
        except Exception as e:
            _handle_error(e, debug)

        try:
            positions_df = load_positions_to_dataframe(settings["positions_path"])
            df, md_text = _run_manage(
                settings["positions_path"],
                positions_df,
                bool(settings["apply_updates"]),
                bool(settings["manage_use_cache"]),
                bool(settings["manage_force_refresh"]),
                settings["manage_csv_path"],
                settings["md_path"],
            )
            st.session_state["last_manage_df"] = df
            st.session_state["last_degiro_md"] = md_text
        except Exception as e:
            _handle_error(e, debug)

        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        write_last_run(LAST_RUN_PATH, ts)
        st.success("Daily routine finished. Jump to Outputs to review results.")

    tab_screener, tab_orders, tab_manage, tab_outputs = st.tabs(
        ["1) Candidates", "2) Orders", "3) Manage positions", "4) Outputs"]
    )

    with tab_screener:
        st.subheader("1) Run screener and draft orders")
        st.info("Step 1: load data, see badges, and add pending orders directly from suggestions.")

        if st.button("Run screener", key="run_screener_btn"):
            try:
                report, report_csv = _run_screener(
                    settings["universe"],
                    int(settings["top_n"]),
                    float(settings["account_size"]),
                    float(settings["risk_pct"]),
                    bool(settings["use_cache"]),
                    bool(settings["force_refresh"]),
                    settings["report_path"],
                )
                st.session_state["last_report"] = report
                st.session_state["last_report_csv"] = report_csv
                ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
                write_last_run(LAST_RUN_PATH, ts)
                st.success("Screener complete. Scroll for guidance and order capture.")
            except Exception as e:
                _handle_error(e, debug)

        report = st.session_state.get("last_report")
        report_csv = st.session_state.get("last_report_csv")

        if isinstance(report, pd.DataFrame) and not report.empty:
            st.caption("Showing up to 50 rows for a quick scan.")
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

            st.subheader("Create pending orders from candidates")
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
                                stop_default = f"{float(stop_price):.2f}" if pd.notna(stop_price) else ""
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
                                save_orders(settings["orders_path"], orders, asof=str(pd.Timestamp.now().date()))
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

    with tab_orders:
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
            _handle_error(e, debug)
            orders = []

        st.caption("Add a manual pending order")
        with st.form("place_order"):
            ticker = st.text_input("Ticker").strip().upper()
            order_type = st.selectbox("Order type", ["BUY_LIMIT", "BUY_STOP"])
            limit_price = st.number_input("Limit/Stop price", min_value=0.01, value=0.01, step=0.01)
            quantity = st.number_input("Quantity", min_value=1, value=1, step=1)
            stop_price_raw = st.text_input("Stop price (optional)")
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
            st.dataframe(pending_df, use_container_width=True)

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

                        positions = load_positions(settings["positions_path"])
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
                        save_positions(settings["positions_path"], positions, asof=str(pd.Timestamp.now().date()))
                    break

                if not had_error:
                    save_orders(settings["orders_path"], orders, asof=str(pd.Timestamp.now().date()))
                    st.success("Order updated.")
                    st.rerun()

        st.subheader("All orders")
        if orders_df.empty:
            st.info("No orders recorded.")
        else:
            st.dataframe(orders_df, use_container_width=True)

    with tab_manage:
        st.subheader("3) Manage positions")
        st.info(
            "Recalculate stops and produce the Degiro checklist. R multiple = (last - entry) / (entry - stop)."
        )

        positions_file = Path(settings["positions_path"])
        if not positions_file.exists():
            st.warning(f"Positions file not found: {settings['positions_path']}")
            if st.button("Create template positions.json", key="create_positions_template"):
                ensure_parent_dir(positions_file)
                positions_file.write_text('{"asof": null, "positions": []}\n', encoding="utf-8")
                st.success("Template created.")
            positions_df = pd.DataFrame()
        else:
            try:
                positions_df = load_positions_to_dataframe(settings["positions_path"])
            except Exception as e:
                _handle_error(e, debug)
                positions_df = pd.DataFrame()

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
            use_container_width=True,
        )

        if st.button("Recalculate stops / checklist", key="manage_btn"):
            try:
                df, md_text = _run_manage(
                    settings["positions_path"],
                    edited_df,
                    bool(settings["apply_updates"]),
                    bool(settings["manage_use_cache"]),
                    bool(settings["manage_force_refresh"]),
                    settings["manage_csv_path"],
                    settings["md_path"],
                )
                st.session_state["last_manage_df"] = df
                st.session_state["last_degiro_md"] = md_text
                ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
                write_last_run(LAST_RUN_PATH, ts)
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
                st.caption("R now shows current profit in R units. Positive = above entry risk.")
                st.dataframe(display, use_container_width=True)
                st.download_button(
                    "Download manage CSV",
                    df.to_csv(index=True),
                    file_name=Path(settings["manage_csv_path"]).name,
                    mime="text/csv",
                )
        if isinstance(md_text, str) and md_text:
            st.subheader("Degiro checklist")
            st.markdown(md_text)
            st.download_button(
                "Download Degiro checklist",
                md_text,
                file_name=Path(settings["md_path"]).name,
                mime="text/markdown",
            )

    with tab_outputs:
        st.subheader("4) Outputs and last run")
        last_run = read_last_run(LAST_RUN_PATH)
        if last_run:
            st.write(f"Last run: {last_run}")

        report_df, report_err = safe_read_csv_preview(settings["report_path"])
        if report_err:
            st.warning(f"Unable to read report CSV: {report_err}")
        elif not report_df.empty:
            st.caption("Report preview")
            st.dataframe(report_df, use_container_width=True)
        else:
            st.info("No report found yet. Run the screener.")

        md_file = Path(settings["md_path"])
        if md_file.exists():
            st.subheader("Degiro actions")
            st.markdown(md_file.read_text(encoding="utf-8"))
        else:
            st.info("Degiro checklist not generated yet. Run management step.")


if __name__ == "__main__":
    main()
