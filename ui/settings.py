from __future__ import annotations

from pathlib import Path

import streamlit as st

from ui.helpers import load_user_defaults, save_user_defaults

PREFS_PATH = Path("ui/.user_defaults.json")

DEFAULT_SETTINGS: dict = {
    "universe": "mega",
    "top_n": 0,  # 0 = no cap (use full universe)
    "account_size": 500.0,
    "risk_pct": 1.0,
    "k_atr": 2.0,
    "max_position_pct": 0.60,
    "bt_start": "2018-01-01",
    "bt_end": "",
    "bt_entry_type": "pullback",
    "bt_breakout_lookback": 50,
    "bt_pullback_ma": 20,
    "bt_atr_window": 14,
    "bt_k_atr": 2.0,
    "bt_exit_mode": "trailing_stop",
    "bt_take_profit_R": 2.0,
    "bt_max_holding_days": 20,
    "bt_breakeven_at_R": 1.0,
    "bt_trail_after_R": 2.0,
    "bt_trail_sma": 20,
    "bt_sma_buffer_pct": 0.005,
    "bt_quick_max_holding_days": 9999,
    "bt_min_trades_per_ticker": 3,
    "bt_min_trades_compare": 30,
    "bt_flag_profit_factor": 1.3,
    "bt_flag_max_dd": -5.0,
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
    "min_price": 10.0,
    "max_price": 60.0,
    "max_atr_pct": 10.0,
    "require_trend_ok": True,
}


def init_settings(universes: list[str]) -> dict:
    stored = load_user_defaults(PREFS_PATH)
    defaults = {**DEFAULT_SETTINGS, **stored}
    if universes:
        defaults["universe"] = (
            defaults["universe"] if defaults["universe"] in universes else universes[0]
        )

    for key, value in defaults.items():
        st.session_state.setdefault(key, value)

    return defaults


def current_settings() -> dict:
    keys = [
        "universe",
        "top_n",
        "account_size",
        "risk_pct",
        "k_atr",
        "max_position_pct",
        "bt_start",
        "bt_end",
        "bt_entry_type",
        "bt_breakout_lookback",
        "bt_pullback_ma",
        "bt_atr_window",
        "bt_k_atr",
        "bt_exit_mode",
        "bt_take_profit_R",
        "bt_max_holding_days",
        "bt_breakeven_at_R",
        "bt_trail_after_R",
        "bt_trail_sma",
        "bt_sma_buffer_pct",
        "bt_quick_max_holding_days",
        "bt_min_trades_per_ticker",
        "bt_min_trades_compare",
        "bt_flag_profit_factor",
        "bt_flag_max_dd",
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
        "min_price",
        "max_price",
        "max_atr_pct",
        "require_trend_ok",
    ]
    return {k: st.session_state.get(k) for k in keys}


def render_sidebar_settings(universes: list[str], defaults: dict) -> bool:
    st.sidebar.header("Session settings")
    st.sidebar.caption("Values here drive every step. Save once, reuse daily.")
    with st.sidebar.form("settings_form"):
        st.selectbox(
            "Universe",
            universes,
            index=universes.index(st.session_state["universe"]),
            key="universe",
            help="Pick the ticker list to scan (default: mega).",
        )
        st.slider(
            "Top N (0 = all)",
            min_value=0,
            max_value=200,
            value=int(st.session_state.get("top_n", defaults["top_n"])),
            step=10,
            key="top_n",
            help="Limit how many candidates you review. Lower = faster and simpler.",
        )
        st.number_input(
            "Account size (EUR)",
            min_value=100.0,
            value=float(st.session_state.get("account_size", defaults["account_size"])),
            step=500.0,
            key="account_size",
        )
        st.slider(
            "Risk per trade (%)",
            min_value=0.5,
            max_value=2.0,
            value=float(st.session_state.get("risk_pct", defaults["risk_pct"])),
            step=0.1,
            key="risk_pct",
            help="Keep between 0.5% and 2% to stay conservative.",
        )
        st.slider(
            "Stop distance (k * ATR)",
            min_value=1.0,
            max_value=3.0,
            value=float(st.session_state.get("k_atr", defaults["k_atr"])),
            step=0.1,
            key="k_atr",
            help="Higher = wider stops (fewer stop-outs, larger position risk). Default 2.0.",
        )
        st.slider(
            "Max position size (% of account)",
            min_value=0.1,
            max_value=1.0,
            value=float(st.session_state.get("max_position_pct", defaults["max_position_pct"])),
            step=0.05,
            key="max_position_pct",
            help="Cap for any single position. Default 0.60 (60%).",
        )
        st.caption("Data options")
        st.checkbox(
            "Use cached data",
            value=bool(st.session_state.get("use_cache", defaults["use_cache"])),
            key="use_cache",
        )
        st.checkbox(
            "Force refresh data",
            value=bool(st.session_state.get("force_refresh", defaults["force_refresh"])),
            key="force_refresh",
        )
        st.caption("Quick backtest (Candidates tab)")
        st.number_input(
            "Max holding days (quick backtest)",
            min_value=1,
            max_value=9999,
            value=int(
                st.session_state.get(
                    "bt_quick_max_holding_days", defaults["bt_quick_max_holding_days"]
                )
            ),
            step=1,
            key="bt_quick_max_holding_days",
            help="Used only for the quick backtest in the Candidates panel.",
        )
        st.caption("Paths")
        st.text_input(
            "Report CSV path",
            value=st.session_state["report_path"],
            key="report_path",
        )
        st.text_input(
            "Positions path",
            value=st.session_state["positions_path"],
            key="positions_path",
        )
        st.text_input(
            "Orders path",
            value=st.session_state["orders_path"],
            key="orders_path",
        )
        st.text_input(
            "Manage CSV path",
            value=st.session_state["manage_csv_path"],
            key="manage_csv_path",
        )
        st.text_input(
            "Degiro checklist path",
            value=st.session_state["md_path"],
            key="md_path",
        )
        st.checkbox(
            "Apply stop updates to positions.json",
            value=bool(st.session_state.get("apply_updates", defaults["apply_updates"])),
            key="apply_updates",
            help="When enabled, stop raises will be written automatically (never lowered).",
        )
        st.checkbox(
            "Use cached data (manage)",
            value=bool(st.session_state.get("manage_use_cache", defaults["manage_use_cache"])),
            key="manage_use_cache",
        )
        st.checkbox(
            "Force refresh data (manage)",
            value=bool(st.session_state.get("manage_force_refresh", defaults["manage_force_refresh"])),
            key="manage_force_refresh",
        )
        st.caption("Filters (more symbols → more rows, can be noisier)")
        st.number_input(
            "Min price (€/$)",
            min_value=0.5,
            max_value=2000.0,
            value=float(st.session_state.get("min_price", defaults["min_price"])),
            step=0.5,
            key="min_price",
        )
        st.number_input(
            "Max price (€/$)",
            min_value=1.0,
            max_value=5000.0,
            value=float(st.session_state.get("max_price", defaults["max_price"])),
            step=1.0,
            key="max_price",
        )
        st.slider(
            "Max ATR% (volatility filter)",
            min_value=1.0,
            max_value=25.0,
            value=float(st.session_state.get("max_atr_pct", defaults["max_atr_pct"])),
            step=0.5,
            key="max_atr_pct",
            help="Higher lets more volatile names in.",
        )
        st.checkbox(
            "Require uptrend (SMA-based)",
            value=bool(st.session_state.get("require_trend_ok", defaults["require_trend_ok"])),
            key="require_trend_ok",
        )
        save_defaults = st.form_submit_button("Save as my defaults")

    if save_defaults:
        save_user_defaults(PREFS_PATH, current_settings())
        st.sidebar.success("Defaults saved for next sessions.")

    return save_defaults
