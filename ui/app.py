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
        ["Daily Screener", "Manage Positions", "Outputs"],
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
            use_container_width=True,
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
                st.dataframe(df, use_container_width=True)
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
            st.dataframe(report_df, use_container_width=True)

        md_file = Path(md_path)
        if md_file.exists():
            st.subheader("Degiro actions")
            st.markdown(md_file.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
