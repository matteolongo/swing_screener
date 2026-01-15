from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Iterable

import pandas as pd

from swing_screener.screeners.universe import UniverseConfig, eligible_universe
from swing_screener.screeners.ranking import RankingConfig, top_candidates
from swing_screener.signals.entries import EntrySignalConfig, build_signal_board
from swing_screener.risk.position_sizing import RiskConfig, build_trade_plans
from swing_screener.execution.guidance import add_execution_guidance


@dataclass(frozen=True)
class ReportConfig:
    universe: UniverseConfig = UniverseConfig()
    ranking: RankingConfig = RankingConfig(top_n=12)
    signals: EntrySignalConfig = EntrySignalConfig(breakout_lookback=50, pullback_ma=20)
    risk: RiskConfig = RiskConfig(account_size=500.0, risk_pct=0.01, k_atr=2.0, max_position_pct=0.60)
    only_active_signals: bool = False


def build_daily_report(ohlcv: pd.DataFrame, cfg: ReportConfig = ReportConfig()) -> pd.DataFrame:
    """
    Pipeline:
      eligible_universe -> ranking top_n -> signals -> trade plans -> merged report
    """
    univ = eligible_universe(ohlcv, cfg.universe)
    if univ is None or univ.empty:
        return pd.DataFrame()

    ranked = top_candidates(univ, cfg.ranking)
    if ranked.empty:
        return pd.DataFrame()

    board = build_signal_board(ohlcv, ranked.index.tolist(), cfg.signals)

    atr_col = f"atr{cfg.universe.vol.atr_window}"
    plans = build_trade_plans(ranked, board, cfg.risk, atr_col=atr_col)

    # merge: ranked features + signal board (left) + plans (left)
    report = ranked.join(board, how="left", rsuffix="_sig")

    if plans is not None and not plans.empty:
        # keep some plan cols
        plan_cols = ["entry", "stop", "shares", "position_value", "realized_risk", "risk_amount_target"]
        plan_cols = [c for c in plan_cols if c in plans.columns]
        report = report.join(plans[plan_cols + ["signal"]], how="left", rsuffix="_plan")

        # prefer signal from plans where available (tradable)
        if "signal_plan" in report.columns:
            report["signal"] = report["signal_plan"].fillna(report["signal"])
            report = report.drop(columns=["signal_plan"], errors="ignore")

    # tidy columns order
    ma_col = f"ma{cfg.signals.pullback_ma}_level"
    keep = [
        "rank", "score",
        "last", atr_col, "atr_pct",
        "mom_6m", "mom_12m", "rs_6m",
        "trend_ok", "dist_sma50_pct", "dist_sma200_pct",
        "signal",
        "breakout_level", ma_col,
        "entry", "stop", "shares", "position_value", "realized_risk",
    ]
    keep = [c for c in keep if c in report.columns]
    report = report[keep]

    if cfg.only_active_signals and "signal" in report.columns:
        report = report[report["signal"].isin(["both", "breakout", "pullback"])]

    # sort: signals first, then score
    if "signal" in report.columns and "score" in report.columns:
        order = {"both": 0, "breakout": 1, "pullback": 2, "none": 3}
        report["signal_order"] = report["signal"].map(order).fillna(99).astype(int)
        report = report.sort_values(["signal_order", "score"], ascending=[True, False]).drop(columns=["signal_order"])

    report = add_execution_guidance(report)
    return report


def export_report_csv(report: pd.DataFrame, path: str = "out/daily_report.csv") -> str:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    report.to_csv(p, index=True)
    return str(p)


def today_actions(report: pd.DataFrame, max_rows: int = 5) -> str:
    """
    Human-friendly summary string of tradable signals.
    """
    if report is None or report.empty:
        return "No candidates. Today: no trade."

    if "signal" not in report.columns:
        return "Report has no signal column. Today: observe only."

    active = report[report["signal"].isin(["both", "breakout", "pullback"])].copy()

    # keep only tradable plans if shares exists
    if "shares" in active.columns:
        active = active[active["shares"].fillna(0) >= 1]

    if active.empty:
        return (
            "No tradable signals with current constraints (e.g. 500€). Today: no trade."
        )

    lines = ["TODAY ACTIONS (tradable signals):"]
    for t, row in active.head(max_rows).iterrows():
        parts = [f"{t}: {row.get('signal', '')}"]
        if pd.notna(row.get("entry", None)):
            parts.append(f"entry~{float(row['entry']):.2f}")
        if pd.notna(row.get("stop", None)):
            parts.append(f"stop~{float(row['stop']):.2f}")
        if pd.notna(row.get("shares", None)):
            parts.append(f"shares={int(row['shares'])}")
        if pd.notna(row.get("realized_risk", None)):
            parts.append(f"risk~{float(row['realized_risk']):.2f}")
        lines.append(" - " + " | ".join(parts))

    return "\n".join(lines)
