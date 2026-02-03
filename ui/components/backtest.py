from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Callable

import pandas as pd
import streamlit as st

from swing_screener.backtest.simulator import BacktestConfig
from ui.helpers import load_backtest_configs, save_backtest_configs


def render_backtest_tab(
    *,
    settings: dict,
    defaults: dict,
    debug: bool,
    handle_error: Callable[[Exception, bool], None],
    backtest_configs_path: Path,
    run_backtest: Callable[..., dict],
) -> None:
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

    saved_configs = load_backtest_configs(backtest_configs_path)

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
        cfg_name_default = (
            f"{entry_type}_{start_label}_{end_label}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        )
        cfg_name = st.text_input(
            "Nome config",
            value=cfg_name_default,
            help="Usa un nome semplice. Verrà salvato per i confronti.",
        )
        k_atr_val = st.slider(
            "Stop distance (k * ATR)",
            1.0,
            3.0,
            float(st.session_state.get("bt_k_atr", defaults["bt_k_atr"])),
            0.1,
            key="bt_k_atr",
        )
        tp_r_val = st.slider(
            "Take profit (R)",
            0.5,
            5.0,
            float(st.session_state.get("bt_take_profit_R", defaults["bt_take_profit_R"])),
            0.25,
            key="bt_take_profit_R",
            disabled=exit_mode == "trailing_stop",
        )
        max_hold = st.number_input(
            "Max holding days",
            5,
            100,
            int(st.session_state.get("bt_max_holding_days", defaults["bt_max_holding_days"])),
            1,
            key="bt_max_holding_days",
        )
        breakout_lb = st.number_input(
            "Breakout lookback",
            10,
            200,
            int(
                st.session_state.get(
                    "bt_breakout_lookback", defaults["bt_breakout_lookback"]
                )
            ),
            5,
            key="bt_breakout_lookback",
        )
        pullback_ma = st.number_input(
            "Pullback MA",
            5,
            100,
            int(st.session_state.get("bt_pullback_ma", defaults["bt_pullback_ma"])),
            1,
            key="bt_pullback_ma",
        )
        atr_win = st.number_input(
            "ATR window",
            5,
            50,
            int(st.session_state.get("bt_atr_window", defaults["bt_atr_window"])),
            1,
            key="bt_atr_window",
        )
        if exit_mode == "trailing_stop":
            breakeven_at_r = st.slider(
                "Breakeven at R",
                0.5,
                3.0,
                float(
                    st.session_state.get("bt_breakeven_at_R", defaults["bt_breakeven_at_R"])
                ),
                0.25,
                key="bt_breakeven_at_R",
                help="Quando R >= soglia, stop sale a entry.",
            )
            trail_after_r = st.slider(
                "Trail after R",
                1.0,
                5.0,
                float(
                    st.session_state.get("bt_trail_after_R", defaults["bt_trail_after_R"])
                ),
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
                value=float(
                    st.session_state.get("bt_sma_buffer_pct", defaults["bt_sma_buffer_pct"])
                ),
                step=0.001,
                key="bt_sma_buffer_pct",
                help="Buffer sotto SMA (es: 0.005 = 0.5%).",
            )
        else:
            breakeven_at_r = float(
                st.session_state.get("bt_breakeven_at_R", defaults["bt_breakeven_at_R"])
            )
            trail_after_r = float(
                st.session_state.get("bt_trail_after_R", defaults["bt_trail_after_R"])
            )
            trail_sma = int(
                st.session_state.get("bt_trail_sma", defaults["bt_trail_sma"])
            )
            sma_buffer_pct = float(
                st.session_state.get("bt_sma_buffer_pct", defaults["bt_sma_buffer_pct"])
            )
        bt_min_trades_per_ticker = st.number_input(
            "Min trades per ticker (include in summary)",
            min_value=1,
            max_value=50,
            value=int(
                st.session_state.get(
                    "bt_min_trades_per_ticker", defaults["bt_min_trades_per_ticker"]
                )
            ),
            step=1,
            key="bt_min_trades_per_ticker",
        )
        bt_min_trades_compare = st.number_input(
            "Min trades (per config) to compare",
            min_value=1,
            max_value=200,
            value=int(
                st.session_state.get(
                    "bt_min_trades_compare", defaults["bt_min_trades_compare"]
                )
            ),
            step=5,
            key="bt_min_trades_compare",
        )
        bt_flag_profit_factor = st.number_input(
            "Caution threshold: profit factor",
            min_value=0.5,
            max_value=3.0,
            value=float(
                st.session_state.get(
                    "bt_flag_profit_factor", defaults["bt_flag_profit_factor"]
                )
            ),
            step=0.1,
            key="bt_flag_profit_factor",
            help="Sotto questo profit factor: flag giallo.",
        )
        bt_flag_max_dd = st.number_input(
            "Caution threshold: max drawdown R",
            min_value=-50.0,
            max_value=0.0,
            value=float(
                st.session_state.get("bt_flag_max_dd", defaults["bt_flag_max_dd"])
            ),
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
        save_backtest_configs(backtest_configs_path, saved_configs)
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
                st.write(
                    f"Breakout lb: {cfg['breakout_lookback']} | Pullback MA: {cfg['pullback_ma']} | ATR win: {cfg['atr_window']}"
                )
                st.caption(f"Start: {cfg.get('start','')} | End: {cfg.get('end','latest')}")
                if st.button(f"Elimina {cfg['name']}", key=f"del_{cfg['name']}"):
                    to_delete.append(cfg)
        if to_delete:
            for cfg in to_delete:
                saved_configs.remove(cfg)
            save_backtest_configs(backtest_configs_path, saved_configs)
            st.success("Config eliminata.")
            st.rerun()

    st.markdown("### Seleziona config da confrontare")
    cfg_names = [c["name"] for c in saved_configs]
    selected_names = st.multiselect(
        "Config", cfg_names, default=cfg_names[: min(3, len(cfg_names))]
    )

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
                    breakeven_at_R=cfg.get(
                        "breakeven_at_R", defaults["bt_breakeven_at_R"]
                    ),
                    trail_after_R=cfg.get(
                        "trail_after_R", defaults["bt_trail_after_R"]
                    ),
                    trail_sma=cfg.get("trail_sma", defaults["bt_trail_sma"]),
                    sma_buffer_pct=cfg.get(
                        "sma_buffer_pct", defaults["bt_sma_buffer_pct"]
                    ),
                )
                res = run_backtest(
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
                handle_error(e, debug)
        st.session_state["bt_results"] = results

    results = st.session_state.get("bt_results", [])
    if not results:
        st.info("Seleziona e lancia i backtest per vedere i risultati.")
    else:
        risk_per_trade = float(settings["account_size"]) * (
            float(settings["risk_pct"]) / 100.0
        )
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
        st.dataframe(df_summary, width="stretch")

        valid = df_summary.dropna(subset=["Expectancy_R", "Trades"])
        valid = valid[valid["Trades"] >= bt_min_trades_compare]
        winner_msg = ""
        if not valid.empty:
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
            st.info(
                f"Nessuna config con almeno {bt_min_trades_compare} trade per confronto."
            )

        st.markdown("**Bandierine (caution)**")
        cautions = []
        for row in rows:
            warns = []
            if row["Trades"] < bt_min_trades_compare:
                warns.append("pochi trade")
            if (
                row["Profit_factor"] is not None
                and row["Profit_factor"] < bt_flag_profit_factor
            ):
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

        st.markdown("**Impatto € (non compounding, stima semplice)**")
        for row in rows:
            if row["€ per trade"] is None:
                continue
            st.markdown(
                f"- **{row['Config']}**: ~**{row['€ per trade']:.2f}€** a trade "
                f"(risk/trade {risk_per_trade:.2f}€, {int(row['Trades'])} trade ≈ **{row['€ totale'] or 0:.2f}€**)"
            )

        if results:
            first = results[0]
            st.subheader(f"Equity curve — {first.get('name','config')}")
            if first["curve"] is not None and not first["curve"].empty:
                st.line_chart(first["curve"].set_index("date")[["cum_R"]])
            else:
                st.info("No equity curve to display.")

            st.subheader(f"Trades sample — {first.get('name','config')}")
            if first["trades"] is not None and not first["trades"].empty:
                st.dataframe(first["trades"].head(200), width="stretch")
                st.download_button(
                    f"Download trades CSV ({first.get('name','config')})",
                    first["trades"].to_csv(index=False),
                    file_name=f"backtest_trades_{first.get('name','config')}.csv",
                    mime="text/csv",
                )
            else:
                st.info("No trades.")
