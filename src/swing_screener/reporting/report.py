from __future__ import annotations

from pathlib import Path
from typing import Iterable

import pandas as pd

from swing_screener.reporting.config import ReportConfig
from swing_screener.strategies.registry import get_strategy_module


def build_daily_report(
    ohlcv: pd.DataFrame,
    cfg: ReportConfig = ReportConfig(),
    exclude_tickers: Iterable[str] | None = None,
) -> pd.DataFrame:
    module = get_strategy_module(cfg.strategy_module)
    return module.build_report(ohlcv, cfg=cfg, exclude_tickers=exclude_tickers)


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


__all__ = ["ReportConfig", "build_daily_report", "export_report_csv", "today_actions"]

