from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Callable

import pandas as pd
import streamlit as st

from ui.helpers import ensure_parent_dir, load_positions_to_dataframe, write_last_run


def render_manage_tab(
    *,
    settings: dict,
    debug: bool,
    run_manage: Callable[..., tuple[pd.DataFrame, str]],
    handle_error: Callable[[Exception, bool], None],
    last_run_path: Path,
) -> None:
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
            handle_error(e, debug)
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
                "exit_date",
                "exit_price",
                "notes",
            ]
        )

    edited_df = st.data_editor(
        positions_df,
        num_rows="dynamic",
        width="stretch",
    )

    closed_df = edited_df[edited_df["status"] == "closed"].copy()
    if not closed_df.empty:
        missing_exit = closed_df[
            closed_df["exit_date"].isna() | closed_df["exit_price"].isna()
        ]
        if not missing_exit.empty:
            st.warning("Closed positions missing exit_date/exit_price won't show realized P/L.")
        realized = closed_df.dropna(subset=["entry_price", "exit_price", "shares"]).copy()
        if not realized.empty:
            realized.loc[:, "pl_value"] = (
                (realized["exit_price"] - realized["entry_price"]) * realized["shares"]
            ).round(2)
            realized.loc[:, "pl_pct"] = (
                (realized["exit_price"] / realized["entry_price"]) - 1.0
            ).mul(100.0).round(2)
            st.subheader("Closed positions (realized P/L)")
            display_cols = [
                "ticker",
                "entry_date",
                "exit_date",
                "entry_price",
                "exit_price",
                "shares",
                "pl_value",
                "pl_pct",
                "notes",
            ]
            display_cols = [c for c in display_cols if c in realized.columns]
            st.dataframe(realized[display_cols], width="stretch")

    if st.button("Recalculate stops / checklist", key="manage_btn"):
        try:
            df, md_text = run_manage(
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
            write_last_run(last_run_path, ts)
        except Exception as e:
            handle_error(e, debug)

    df = st.session_state.get("last_manage_df")
    md_text = st.session_state.get("last_degiro_md")
    if isinstance(df, pd.DataFrame):
        if df.empty:
            st.info("No management actions.")
        else:
            display = df.copy()
            if {"last", "entry", "shares"}.issubset(display.columns):
                display["position_value"] = (display["last"] * display["shares"]).round(2)
                display["pl_value"] = (
                    (display["last"] - display["entry"]) * display["shares"]
                ).round(2)
                display["pl_pct"] = (
                    (display["last"] / display["entry"]) - 1.0
                ).mul(100.0).round(2)
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
                    "position_value": "Position Value ($)",
                    "pl_value": "P/L ($)",
                    "pl_pct": "P/L (%)",
                }
            )
            st.caption("R now shows current profit in R units. Positive = above entry risk.")
            st.dataframe(display, width="stretch")
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
