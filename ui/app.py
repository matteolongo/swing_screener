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
from ui.helpers import (
    list_available_universes,
    ensure_parent_dir,
    load_positions_to_dataframe,
    safe_read_csv_preview,
    read_last_run,
    write_last_run,
)
from ui.settings import init_settings, current_settings, render_sidebar_settings
from ui.components.candidates import render_candidates_tab
from ui.components.manage import render_manage_tab
from ui.components.orders import render_orders_tab
from ui.components.backtest import render_backtest_tab
from ui.flows.manage import run_manage
from ui.flows.backtest import run_backtest

LAST_RUN_PATH = Path("ui/.last_run.json")
BACKTEST_CONFIGS_PATH = Path("ui/.backtest_configs.json")

def _handle_error(e: Exception, debug: bool) -> None:
    st.error(str(e))
    if debug:
        st.exception(e)


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


def main() -> None:
    st.set_page_config(page_title="Swing Screener UI", layout="wide")
    st.title("Swing Screener — Daily dashboard")
    st.caption("Beginner-friendly flow: run screener → draft orders → manage open trades → review outputs.")

    universes = list_available_universes()
    if not universes:
        st.error("No universes found in package data.")
        st.stop()

    defaults = init_settings(universes)
    render_sidebar_settings(universes, defaults)
    st.sidebar.header("Utilities")
    debug = st.sidebar.checkbox("Debug mode", value=False)

    st.markdown(
        """
        **Quick tips**
        - Run after US market close, once per day.
        - Follow the steps left-to-right. Green/blue badges mean actionable orders.
        - Keep risk % modest; avoid changing stops downward.
        """
    )

    run_daily = st.button("Run daily routine (screener + manage)", type="primary")

    settings = current_settings()

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
            df, md_text = run_manage(
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
        render_candidates_tab(
            settings=settings,
            debug=debug,
            run_screener=_run_screener,
            handle_error=_handle_error,
            last_run_path=LAST_RUN_PATH,
        )

    with tab_orders:
        render_orders_tab(
            settings=settings,
            debug=debug,
            handle_error=_handle_error,
        )

    with tab_manage:
        render_manage_tab(
            settings=settings,
            debug=debug,
            run_manage=run_manage,
            handle_error=_handle_error,
            last_run_path=LAST_RUN_PATH,
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
        render_backtest_tab(
            settings=settings,
            defaults=defaults,
            debug=debug,
            handle_error=_handle_error,
            backtest_configs_path=BACKTEST_CONFIGS_PATH,
            run_backtest=run_backtest,
        )


if __name__ == "__main__":
    main()
