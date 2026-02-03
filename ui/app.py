from __future__ import annotations

import sys
from pathlib import Path
from datetime import datetime

import pandas as pd
import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from swing_screener.data.market_data import MarketDataConfig, fetch_ohlcv, fetch_ticker_metadata
from swing_screener.data.universe import UniverseConfig as DataUniverseConfig, load_universe_from_package
from swing_screener.reporting.report import ReportConfig, build_daily_report
from swing_screener.screeners.ranking import RankingConfig
from swing_screener.screeners.universe import UniverseConfig as ScreenUniverseConfig, UniverseFilterConfig
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
from swing_screener.execution.order_workflows import fill_entry_order, scale_in_fill
from swing_screener.backtest.portfolio import (
    backtest_portfolio_R,
    equity_curve_R,
    drawdown_stats,
    PortfolioBacktestConfig,
)
from swing_screener.backtest.simulator import (
    BacktestConfig,
    backtest_single_ticker_R,
    summarize_trades,
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
    build_degiro_entry_lines,
    load_orders,
    orders_to_dataframe,
    save_orders,
    make_order_entry,
    orders_dicts_to_models,
    orders_models_to_dicts,
    is_entry_order,
    load_user_defaults,
    save_user_defaults,
    load_backtest_configs,
    save_backtest_configs,
)

PREFS_PATH = Path("ui/.user_defaults.json")
LAST_RUN_PATH = Path("ui/.last_run.json")
BACKTEST_CONFIGS_PATH = Path("ui/.backtest_configs.json")

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
    k_atr: float,
    max_position_pct: float,
    use_cache: bool,
    force_refresh: bool,
    report_path: str,
    min_price: float,
    max_price: float,
    max_atr_pct: float,
    require_trend_ok: bool,
) -> tuple[pd.DataFrame, str]:
    ucfg = DataUniverseConfig(benchmark="SPY", ensure_benchmark=True, max_tickers=top_n or None)
    tickers = load_universe_from_package(universe, ucfg)

    ranking_top_n = top_n if top_n and top_n > 0 else 10_000  # 0 = no cap in UI -> effectively all

    ohlcv = fetch_ohlcv(
        tickers,
        MarketDataConfig(),
        use_cache=use_cache,
        force_refresh=force_refresh,
    )

    rcfg = ReportConfig(
        universe=ScreenUniverseConfig(
            filt=UniverseFilterConfig(
                min_price=min_price,
                max_price=max_price,
                max_atr_pct=max_atr_pct,
                require_trend_ok=require_trend_ok,
            )
        ),
        ranking=RankingConfig(top_n=ranking_top_n),
        risk=RiskConfig(
            account_size=account_size,
            risk_pct=risk_pct / 100.0,
            k_atr=k_atr,
            max_position_pct=max_position_pct,
        ),
    )
    report = build_daily_report(ohlcv, rcfg)

    # enrich with basic metadata (name, currency, exchange) for display
    try:
        meta_df = fetch_ticker_metadata(
            report.index.tolist(),
            cache_path=".cache/ticker_meta.json",
            use_cache=use_cache,
            force_refresh=force_refresh,
        )
        if not meta_df.empty:
            meta_df = meta_df.reindex(report.index)
            report.insert(0, "exchange", meta_df["exchange"])
            report.insert(0, "currency", meta_df["currency"])
            report.insert(0, "name", meta_df["name"])
    except Exception:
        pass

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


def _run_backtest(
    universe: str,
    top_n: int,
    start: str,
    end: str,
    cfg_a: BacktestConfig,
    min_trades_per_ticker: int,
    use_cache: bool,
    force_refresh: bool,
) -> dict:
    ucfg = DataUniverseConfig(benchmark="SPY", ensure_benchmark=True, max_tickers=top_n or None)
    tickers = load_universe_from_package(universe, ucfg)

    start_clean = str(start).replace("/", "-") if start else "2018-01-01"
    end_clean = str(end).replace("/", "-") if end else None
    mcfg = MarketDataConfig(start=start_clean or "2018-01-01", end=end_clean or None)
    ohlcv = fetch_ohlcv(
        tickers,
        mcfg,
        use_cache=use_cache,
        force_refresh=force_refresh,
    )

    portfolio_cfg = PortfolioBacktestConfig(bt=cfg_a, min_trades_per_ticker=min_trades_per_ticker)
    trades_all, summary_by_ticker, summary_total = backtest_portfolio_R(ohlcv, tickers, portfolio_cfg)
    curve = equity_curve_R(trades_all)
    dd = drawdown_stats(curve)

    # enrich summary_total with drawdown and trade extremes
    if summary_total is None or summary_total.empty:
        summary_total = pd.DataFrame([{"trades": 0}])
    summary_total = summary_total.copy()
    summary_total["max_drawdown_R"] = dd.get("max_drawdown_R", None)
    if trades_all is not None and not trades_all.empty:
        summary_total["best_trade_R"] = trades_all["R"].max()
        summary_total["worst_trade_R"] = trades_all["R"].min()
    else:
        summary_total["best_trade_R"] = None
        summary_total["worst_trade_R"] = None

    return {
        "trades": trades_all,
        "summary_by_ticker": summary_by_ticker,
        "summary_total": summary_total,
        "curve": curve,
    }


def _build_bt_config_from_settings(
    settings: dict, *, min_history: int | None = None
) -> BacktestConfig:
    cfg = BacktestConfig(
        entry_type=str(settings.get("bt_entry_type", "pullback")),
        breakout_lookback=int(settings.get("bt_breakout_lookback", 50)),
        pullback_ma=int(settings.get("bt_pullback_ma", 20)),
        atr_window=int(settings.get("bt_atr_window", 14)),
        k_atr=float(settings.get("bt_k_atr", 2.0)),
        exit_mode=str(settings.get("bt_exit_mode", "take_profit")),
        take_profit_R=float(settings.get("bt_take_profit_R", 2.0)),
        max_holding_days=int(settings.get("bt_max_holding_days", 20)),
        breakeven_at_R=float(settings.get("bt_breakeven_at_R", 1.0)),
        trail_after_R=float(settings.get("bt_trail_after_R", 2.0)),
        trail_sma=int(settings.get("bt_trail_sma", 20)),
        sma_buffer_pct=float(settings.get("bt_sma_buffer_pct", 0.005)),
        min_history=int(min_history) if min_history is not None else 200,
    )
    return cfg


def _run_quick_backtest_single(
    ticker: str,
    cfg: BacktestConfig,
    start: str,
    end: str,
    use_cache: bool,
    force_refresh: bool,
) -> dict:
    mcfg = MarketDataConfig(start=start, end=end or None)
    ohlcv = fetch_ohlcv(
        [ticker],
        mcfg,
        use_cache=use_cache,
        force_refresh=force_refresh,
    )
    trades = backtest_single_ticker_R(ohlcv, ticker, cfg)
    summary = summarize_trades(trades)
    curve = equity_curve_R(trades)
    dd = drawdown_stats(curve)

    if summary is None or summary.empty:
        summary = pd.DataFrame([{"trades": 0}])
    summary = summary.copy()
    summary["max_drawdown_R"] = dd.get("max_drawdown_R", None)
    if trades is not None and not trades.empty:
        summary["best_trade_R"] = trades["R"].max()
        summary["worst_trade_R"] = trades["R"].min()
    else:
        summary["best_trade_R"] = None
        summary["worst_trade_R"] = None

    close_series = ohlcv["Close"][ticker].dropna()
    bars = int(len(close_series))

    warnings = []
    if bars < cfg.min_history:
        warnings.append(
            f"Not enough bars for min_history ({bars} < {cfg.min_history})."
        )
    if cfg.entry_type == "breakout" and bars < cfg.breakout_lookback + 1:
        warnings.append(
            f"Not enough bars for breakout lookback ({bars} < {cfg.breakout_lookback + 1})."
        )
    if cfg.entry_type == "pullback" and bars < cfg.pullback_ma + 1:
        warnings.append(
            f"Not enough bars for pullback MA ({bars} < {cfg.pullback_ma + 1})."
        )
    if bars < cfg.atr_window + 1:
        warnings.append(f"Not enough bars for ATR window ({bars} < {cfg.atr_window + 1}).")
    if cfg.exit_mode == "trailing_stop" and bars < cfg.trail_sma + 1:
        warnings.append(
            f"Not enough bars for trailing SMA ({bars} < {cfg.trail_sma + 1})."
        )

    return {
        "ticker": ticker,
        "start": start,
        "end": end,
        "bars": bars,
        "trades": trades,
        "summary": summary,
        "warnings": warnings,
    }


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
        k_atr = st.slider(
            "Stop distance (k * ATR)",
            min_value=1.0,
            max_value=3.0,
            value=float(st.session_state.get("k_atr", defaults["k_atr"])),
            step=0.1,
            key="k_atr",
            help="Higher = wider stops (fewer stop-outs, larger position risk). Default 2.0.",
        )
        max_position_pct = st.slider(
            "Max position size (% of account)",
            min_value=0.1,
            max_value=1.0,
            value=float(st.session_state.get("max_position_pct", defaults["max_position_pct"])),
            step=0.05,
            key="max_position_pct",
            help="Cap for any single position. Default 0.60 (60%).",
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
        st.caption("Filters (more symbols → more rows, can be noisier)")
        min_price = st.number_input(
            "Min price (€/$)",
            min_value=0.5,
            max_value=2000.0,
            value=float(st.session_state.get("min_price", defaults["min_price"])),
            step=0.5,
            key="min_price",
        )
        max_price = st.number_input(
            "Max price (€/$)",
            min_value=1.0,
            max_value=5000.0,
            value=float(st.session_state.get("max_price", defaults["max_price"])),
            step=1.0,
            key="max_price",
        )
        max_atr_pct = st.slider(
            "Max ATR% (volatility filter)",
            min_value=1.0,
            max_value=25.0,
            value=float(st.session_state.get("max_atr_pct", defaults["max_atr_pct"])),
            step=0.5,
            key="max_atr_pct",
            help="Higher lets more volatile names in.",
        )
        require_trend_ok = st.checkbox(
            "Require uptrend (SMA-based)",
            value=bool(st.session_state.get("require_trend_ok", defaults["require_trend_ok"])),
            key="require_trend_ok",
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

    tab_screener, tab_orders, tab_manage, tab_outputs, tab_backtest = st.tabs(
        ["1) Candidates", "2) Orders", "3) Manage positions", "4) Outputs", "5) Backtest"]
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
            st.subheader("Quick backtest")
            st.caption(
                "Run a quick backtest for any candidate using current backtest defaults. "
                "Choose the lookback window in months. Results may be empty if the lookback windows exceed the available bars."
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
                        cfg_bt = _build_bt_config_from_settings(settings)
                        month_start = (pd.Timestamp(month_end) - pd.DateOffset(months=months_back)).date()
                        start_str = str(month_start)
                        end_str = str(month_end)
                        res_key = f"{ticker}|{months_back}"
                        with st.spinner(f"Running backtest for {ticker} ({months_back} months)..."):
                            res = _run_quick_backtest_single(
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
                        st.dataframe(res["summary"], width='stretch')
                        if res["trades"] is not None and not res["trades"].empty:
                            st.dataframe(res["trades"].head(200), width='stretch')
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
                # reorder for clarity
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
                            (p for p in existing_positions if p.status == "open" and p.ticker == ticker),
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
                                        stop_price=float(stop_price) if pd.notna(stop_price) else None,
                                        notes="from guidance (scale-in)" if has_open_position else "from guidance",
                                    )
                                )
                                save_orders(settings["orders_path"], orders, asof=str(pd.Timestamp.now().date()))
                                st.success(f"Order added: {ticker}")
                                st.rerun()
                            if reason:
                                st.caption(reason)
                            elif has_open_position:
                                st.caption("Scale-in: blends entry/shares; stop stays unchanged on fill.")

                    for ticker, row, order_type, order_price in order_rows:
                        open_pos = next(
                            (p for p in existing_positions if p.status == "open" and p.ticker == ticker),
                            None,
                        )
                        stop_price = (
                            float(open_pos.stop_price)
                            if open_pos is not None
                            else row.get("stop", None)
                        )
                        shares = row.get("shares", None)
                        price_label = f"{float(order_price):.2f}" if pd.notna(order_price) else "n/a"
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
                                stop_default = f"{float(stop_price):.2f}" if pd.notna(stop_price) else ""
                                stop_price_input = st.text_input(
                                    "Stop-loss price (optional)",
                                    value=stop_default,
                                    key=f"{key_base}_stop",
                                )
                                notes = st.text_input("Notes (optional)", key=f"{key_base}_notes")
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
            st.dataframe(pending_df, width='stretch')

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
                    st.dataframe(display, width='stretch')

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
                                action_options = ["Save pending changes", "Scale-in (mark filled)", "Mark cancelled"]
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
                                    order_models = orders_dicts_to_models(orders)
                                    new_order_models, new_positions = scale_in_fill(
                                        order_models,
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

                                orders = orders_models_to_dicts(new_order_models)
                                positions = new_positions
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
                                        st.error(f"{order['ticker']}: take profit must be a number.")
                                        had_error = True
                                        break

                                try:
                                    order_models = orders_dicts_to_models(orders)
                                    new_order_models, new_positions = fill_entry_order(
                                        order_models,
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

                                orders = orders_models_to_dicts(new_order_models)
                                positions = new_positions
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
            st.dataframe(orders_df, width='stretch')

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
            width='stretch',
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
                if {"last", "entry", "shares"}.issubset(display.columns):
                    display["position_value"] = (display["last"] * display["shares"]).round(2)
                    display["pl_value"] = ((display["last"] - display["entry"]) * display["shares"]).round(2)
                    display["pl_pct"] = ((display["last"] / display["entry"]) - 1.0).mul(100.0).round(2)
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
                st.dataframe(display, width='stretch')
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
            st.dataframe(report_df, width='stretch')
        else:
            st.info("No report found yet. Run the screener.")

        md_file = Path(settings["md_path"])
        if md_file.exists():
            st.subheader("Degiro actions")
            st.markdown(md_file.read_text(encoding="utf-8"))
        else:
            st.info("Degiro checklist not generated yet. Run management step.")

    with tab_backtest:
        st.subheader("5) Backtest")
        st.info(
            "Simulate breakout/pullback rules on history. "
            "Puoi scegliere exit con take profit o trailing stop (breakeven + SMA). "
            "Usa pochi parametri ed evita curve fitting."
        )

        with st.expander("Come leggere i risultati", expanded=False):
            st.markdown(
                """
                - **expectancy_R / avg_R**: R medio per trade. >0 è buono; confronta tra settaggi.
                - **winrate**: % trade > 0R; non basta da sola.
                - **profit_factor_R**: R vinti / |R persi|. >1.3-1.5 è decente.
                - **max_drawdown_R**: peggior drawdown della curva in R. Più vicino a 0 è meglio.
                - **best/worst trade R**: coda della distribuzione (rischio estremo).
                - **trades**: servono campioni sufficienti. Guarda anche curve/volatilità della curva.
                - **exit mode**: take profit tende a troncare i winner; trailing stop è più vicino alla gestione reale.
                - Confronto: privilegia set con drawdown minore a parità di expectancy, o con expectancy migliore a drawdown simile. Verifica stabilità su più periodi/universi.
                """
            )

        saved_configs = load_backtest_configs(BACKTEST_CONFIGS_PATH)

        st.markdown("### Crea e salva configurazioni")
        with st.form("backtest_save_form"):
            bt_start_val = st.session_state.get("bt_start", defaults["bt_start"])
            if isinstance(bt_start_val, str):
                bt_start_val = bt_start_val.strip()
            try:
                bt_start_parsed = pd.to_datetime(bt_start_val).date()
            except Exception:
                bt_start_parsed = datetime.utcnow().date()
            st.session_state["bt_start"] = bt_start_parsed
            bt_start = st.date_input(
                "Start date",
                value=bt_start_parsed,
                key="bt_start",
            )
            bt_end_raw = st.text_input(
                "End date (blank = latest)",
                value=str(st.session_state.get("bt_end", defaults["bt_end"])),
                key="bt_end",
            )
            entry_type = st.selectbox(
                "Entry type",
                ["pullback", "breakout"],
                key="bt_entry_type",
                help="pullback = buy limit su MA; breakout = buy stop oltre massimo.",
            )
            exit_mode = st.selectbox(
                "Exit mode",
                ["trailing_stop", "take_profit"],
                key="bt_exit_mode",
                help="trailing_stop = solo stop con breakeven + trailing; take_profit = TP fisso in R.",
            )
            end_label = (bt_end_raw.strip() or "latest").replace("/", "_")
            start_label = str(bt_start).replace("/", "_")
            cfg_name_default = f"{entry_type}_{start_label}_{end_label}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
            cfg_name = st.text_input("Nome config", value=cfg_name_default, help="Usa un nome semplice. Verrà salvato per i confronti.")
            k_atr_val = st.slider("Stop distance (k * ATR)", 1.0, 3.0, float(st.session_state.get("bt_k_atr", defaults["bt_k_atr"])), 0.1, key="bt_k_atr")
            tp_r_val = st.slider(
                "Take profit (R)",
                0.5,
                5.0,
                float(st.session_state.get("bt_take_profit_R", defaults["bt_take_profit_R"])),
                0.25,
                key="bt_take_profit_R",
                disabled=exit_mode == "trailing_stop",
            )
            max_hold = st.number_input("Max holding days", 5, 100, int(st.session_state.get("bt_max_holding_days", defaults["bt_max_holding_days"])), 1, key="bt_max_holding_days")
            breakout_lb = st.number_input("Breakout lookback", 10, 200, int(st.session_state.get("bt_breakout_lookback", defaults["bt_breakout_lookback"])), 5, key="bt_breakout_lookback")
            pullback_ma = st.number_input("Pullback MA", 5, 100, int(st.session_state.get("bt_pullback_ma", defaults["bt_pullback_ma"])), 1, key="bt_pullback_ma")
            atr_win = st.number_input("ATR window", 5, 50, int(st.session_state.get("bt_atr_window", defaults["bt_atr_window"])), 1, key="bt_atr_window")
            if exit_mode == "trailing_stop":
                breakeven_at_r = st.slider(
                    "Breakeven at R",
                    0.5,
                    3.0,
                    float(st.session_state.get("bt_breakeven_at_R", defaults["bt_breakeven_at_R"])),
                    0.25,
                    key="bt_breakeven_at_R",
                    help="Quando R >= soglia, stop sale a entry.",
                )
                trail_after_r = st.slider(
                    "Trail after R",
                    1.0,
                    5.0,
                    float(st.session_state.get("bt_trail_after_R", defaults["bt_trail_after_R"])),
                    0.25,
                    key="bt_trail_after_R",
                    help="Quando R >= soglia, stop trail sotto SMA.",
                )
                trail_sma = st.number_input(
                    "Trail SMA window",
                    5,
                    100,
                    int(st.session_state.get("bt_trail_sma", defaults["bt_trail_sma"])),
                    1,
                    key="bt_trail_sma",
                )
                sma_buffer_pct = st.number_input(
                    "SMA buffer (decimal)",
                    min_value=0.0,
                    max_value=0.05,
                    value=float(st.session_state.get("bt_sma_buffer_pct", defaults["bt_sma_buffer_pct"])),
                    step=0.001,
                    key="bt_sma_buffer_pct",
                    help="Buffer sotto SMA (es: 0.005 = 0.5%).",
                )
            else:
                breakeven_at_r = float(st.session_state.get("bt_breakeven_at_R", defaults["bt_breakeven_at_R"]))
                trail_after_r = float(st.session_state.get("bt_trail_after_R", defaults["bt_trail_after_R"]))
                trail_sma = int(st.session_state.get("bt_trail_sma", defaults["bt_trail_sma"]))
                sma_buffer_pct = float(st.session_state.get("bt_sma_buffer_pct", defaults["bt_sma_buffer_pct"]))
            bt_min_trades_per_ticker = st.number_input(
                "Min trades per ticker (include in summary)",
                min_value=1,
                max_value=50,
                value=int(st.session_state.get("bt_min_trades_per_ticker", defaults["bt_min_trades_per_ticker"])),
                step=1,
                key="bt_min_trades_per_ticker",
            )
            bt_min_trades_compare = st.number_input(
                "Min trades (per config) to compare",
                min_value=1,
                max_value=200,
                value=int(st.session_state.get("bt_min_trades_compare", defaults["bt_min_trades_compare"])),
                step=5,
                key="bt_min_trades_compare",
            )
            bt_flag_profit_factor = st.number_input(
                "Caution threshold: profit factor",
                min_value=0.5,
                max_value=3.0,
                value=float(st.session_state.get("bt_flag_profit_factor", defaults["bt_flag_profit_factor"])),
                step=0.1,
                key="bt_flag_profit_factor",
                help="Sotto questo profit factor: flag giallo.",
            )
            bt_flag_max_dd = st.number_input(
                "Caution threshold: max drawdown R",
                min_value=-50.0,
                max_value=0.0,
                value=float(st.session_state.get("bt_flag_max_dd", defaults["bt_flag_max_dd"])),
                step=0.5,
                key="bt_flag_max_dd",
                help="Più negativo di questo: flag giallo.",
            )
            save_cfg = st.form_submit_button("Salva configurazione")

        if save_cfg:
            saved_configs.append(
                {
                    "name": cfg_name.strip() or cfg_name_default,
                    "created_at": datetime.utcnow().isoformat(),
                    "entry_type": entry_type,
                    "k_atr": float(k_atr_val),
                    "exit_mode": exit_mode,
                    "take_profit_R": float(tp_r_val),
                    "max_holding_days": int(max_hold),
                    "breakeven_at_R": float(breakeven_at_r),
                    "trail_after_R": float(trail_after_r),
                    "trail_sma": int(trail_sma),
                    "sma_buffer_pct": float(sma_buffer_pct),
                    "breakout_lookback": int(breakout_lb),
                    "pullback_ma": int(pullback_ma),
                    "atr_window": int(atr_win),
                    "bt_min_trades_per_ticker": int(bt_min_trades_per_ticker),
                    "bt_min_trades_compare": int(bt_min_trades_compare),
                    "bt_flag_profit_factor": float(bt_flag_profit_factor),
                    "bt_flag_max_dd": float(bt_flag_max_dd),
                    "start": str(bt_start),
                    "end": bt_end_raw.strip(),
                }
            )
            save_backtest_configs(BACKTEST_CONFIGS_PATH, saved_configs)
            st.success("Config salvata.")
            st.rerun()

        st.markdown("### Config salvate")
        if not saved_configs:
            st.info("Nessuna config salvata. Creane una sopra.")
        else:
            to_delete = []
            for cfg in saved_configs:
                with st.expander(f"{cfg['name']} ({cfg['entry_type']}) — {cfg.get('created_at','')}"):
                    exit_mode_label = cfg.get("exit_mode", "take_profit")
                    if exit_mode_label == "trailing_stop":
                        st.write(
                            "Stop k_ATR: "
                            f"{cfg['k_atr']} | Exit: trailing_stop "
                            f"(BE {cfg.get('breakeven_at_R', defaults['bt_breakeven_at_R'])}R, "
                            f"trail after {cfg.get('trail_after_R', defaults['bt_trail_after_R'])}R, "
                            f"SMA{cfg.get('trail_sma', defaults['bt_trail_sma'])}, "
                            f"buf {cfg.get('sma_buffer_pct', defaults['bt_sma_buffer_pct']) * 100:.2f}%) "
                            f"| Max hold: {cfg['max_holding_days']}d"
                        )
                    else:
                        st.write(
                            f"Stop k_ATR: {cfg['k_atr']} | Exit: take_profit "
                            f"(TP {cfg['take_profit_R']}R) | Max hold: {cfg['max_holding_days']}d"
                        )
                    st.write(f"Breakout lb: {cfg['breakout_lookback']} | Pullback MA: {cfg['pullback_ma']} | ATR win: {cfg['atr_window']}")
                    st.caption(f"Start: {cfg.get('start','')} | End: {cfg.get('end','latest')}")
                    if st.button(f"Elimina {cfg['name']}", key=f"del_{cfg['name']}"):
                        to_delete.append(cfg)
            if to_delete:
                for cfg in to_delete:
                    saved_configs.remove(cfg)
                save_backtest_configs(BACKTEST_CONFIGS_PATH, saved_configs)
                st.success("Config eliminata.")
                st.rerun()

        st.markdown("### Seleziona config da confrontare")
        cfg_names = [c["name"] for c in saved_configs]
        selected_names = st.multiselect("Config", cfg_names, default=cfg_names[: min(3, len(cfg_names))])

        if st.button("Esegui backtest sulle config selezionate"):
            results = []
            for cfg in saved_configs:
                if cfg["name"] not in selected_names:
                    continue
                try:
                    cfg_bt = BacktestConfig(
                        entry_type=cfg["entry_type"],  # type: ignore[arg-type]
                        breakout_lookback=cfg["breakout_lookback"],
                        pullback_ma=cfg["pullback_ma"],
                        atr_window=cfg["atr_window"],
                        k_atr=cfg["k_atr"],
                        exit_mode=cfg.get("exit_mode", "take_profit"),
                        take_profit_R=cfg.get("take_profit_R", defaults["bt_take_profit_R"]),
                        max_holding_days=cfg["max_holding_days"],
                        breakeven_at_R=cfg.get("breakeven_at_R", defaults["bt_breakeven_at_R"]),
                        trail_after_R=cfg.get("trail_after_R", defaults["bt_trail_after_R"]),
                        trail_sma=cfg.get("trail_sma", defaults["bt_trail_sma"]),
                        sma_buffer_pct=cfg.get("sma_buffer_pct", defaults["bt_sma_buffer_pct"]),
                    )
                    res = _run_backtest(
                        settings["universe"],
                        int(settings["top_n"]),
                        cfg.get("start") or str(bt_start),
                        cfg.get("end") or "",
                        cfg_bt,
                        int(cfg.get("bt_min_trades_per_ticker", bt_min_trades_per_ticker)),
                        bool(settings["use_cache"]),
                        bool(settings["force_refresh"]),
                    )
                    res["name"] = cfg["name"]
                    res["cfg"] = cfg
                    results.append(res)
                except Exception as e:
                    _handle_error(e, debug)
            st.session_state["bt_results"] = results

        results = st.session_state.get("bt_results", [])
        if not results:
            st.info("Seleziona e lancia i backtest per vedere i risultati.")
        else:
            risk_per_trade = float(settings["account_size"]) * (float(settings["risk_pct"]) / 100.0)
            rows = []

            def _metric(summary: pd.DataFrame, key: str):
                if summary is None or summary.empty or key not in summary:
                    return None
                val = summary.iloc[0].get(key)
                return float(val) if pd.notna(val) else None

            for res in results:
                summary = res["summary_total"]
                name = res.get("name", "config")
                exp_r = _metric(summary, "expectancy_R")
                pf = _metric(summary, "profit_factor_R")
                dd = _metric(summary, "max_drawdown_R")
                trades = _metric(summary, "trades") or 0
                per_trade_eur = exp_r * risk_per_trade if exp_r is not None else None
                total_eur = per_trade_eur * trades if per_trade_eur is not None else None
                rows.append(
                    {
                        "Config": name,
                        "Expectancy_R": exp_r,
                        "Profit_factor": pf,
                        "Max_drawdown_R": dd,
                        "Trades": trades,
                        "€ per trade": per_trade_eur,
                        "€ totale": total_eur,
                    }
                )

            df_summary = pd.DataFrame(rows)
            st.subheader("Panoramica")
            st.dataframe(df_summary, width='stretch')

            # Winner highlight
            valid = df_summary.dropna(subset=["Expectancy_R", "Trades"])
            valid = valid[valid["Trades"] >= bt_min_trades_compare]
            winner_msg = ""
            if not valid.empty:
                # pick highest expectancy; tiebreak by higher profit factor, then less negative drawdown
                valid = valid.copy()
                valid["pf"] = valid["Profit_factor"].fillna(-1e9)
                valid["dd"] = valid["Max_drawdown_R"].fillna(-1e9)
                winner_row = valid.sort_values(
                    ["Expectancy_R", "pf", "dd"],
                    ascending=[False, False, False],
                ).iloc[0]
                winner_msg = (
                    f"Config vincente: **{winner_row['Config']}** "
                    f"(Expectancy {winner_row['Expectancy_R']:.2f}R, "
                    f"PF {winner_row['Profit_factor'] or 0:.2f}, "
                    f"DD {winner_row['Max_drawdown_R'] or 0:.2f}R)"
                )
                st.success(winner_msg)
            else:
                st.info(f"Nessuna config con almeno {bt_min_trades_compare} trade per confronto.")

            st.markdown("**Bandierine (caution)**")
            cautions = []
            for row in rows:
                warns = []
                if row["Trades"] < bt_min_trades_compare:
                    warns.append("pochi trade")
                if row["Profit_factor"] is not None and row["Profit_factor"] < bt_flag_profit_factor:
                    warns.append("profit factor basso")
                if row["Max_drawdown_R"] is not None and row["Max_drawdown_R"] < bt_flag_max_dd:
                    warns.append("drawdown profondo")
                if warns:
                    cautions.append(f"{row['Config']}: " + ", ".join(warns))
            if cautions:
                for c in cautions:
                    st.warning(c)
            else:
                st.info("Nessuna caution flag con le soglie attuali.")

            # Bold € impact
            st.markdown("**Impatto € (non compounding, stima semplice)**")
            for row in rows:
                if row["€ per trade"] is None:
                    continue
                st.markdown(
                    f"- **{row['Config']}**: ~**{row['€ per trade']:.2f}€** a trade "
                    f"(risk/trade {risk_per_trade:.2f}€, {int(row['Trades'])} trade ≈ **{row['€ totale'] or 0:.2f}€**)"
                )

            # Details for first config selected
            if results:
                first = results[0]
                st.subheader(f"Equity curve — {first.get('name','config')}")
                if first["curve"] is not None and not first["curve"].empty:
                    st.line_chart(first["curve"].set_index("date")[["cum_R"]])
                else:
                    st.info("No equity curve to display.")

                st.subheader(f"Trades sample — {first.get('name','config')}")
                if first["trades"] is not None and not first["trades"].empty:
                    st.dataframe(first["trades"].head(200), width='stretch')
                    st.download_button(
                        f"Download trades CSV ({first.get('name','config')})",
                        first["trades"].to_csv(index=False),
                        file_name=f"backtest_trades_{first.get('name','config')}.csv",
                        mime="text/csv",
                    )
                else:
                    st.info("No trades.")


if __name__ == "__main__":
    main()
