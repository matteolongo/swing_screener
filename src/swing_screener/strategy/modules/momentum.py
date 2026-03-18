from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import pandas as pd

from swing_screener.strategy.report_config import ReportConfig
from swing_screener.selection.universe import eligible_universe
from swing_screener.selection.ranking import top_candidates
from swing_screener.selection.entries import build_signal_board
from swing_screener.risk.position_sizing import build_trade_plans
from swing_screener.execution.guidance import add_execution_guidance


def _normalize_ticker_set(items: Iterable[str] | None) -> set[str]:
    if not items:
        return set()
    out: set[str] = set()
    for item in items:
        if item is None:
            continue
        t = str(item).strip().upper()
        if t:
            out.add(t)
    return out


def _compute_confidence(report: pd.DataFrame, max_atr_pct: float) -> pd.Series:
    """
    Confidence (0-100) for all candidates.
    Uses existing features: score, signal (optional), dist_sma200_pct, atr_pct.
    """
    if report is None or report.empty:
        return pd.Series(dtype=float)

    score = report["score"] if "score" in report.columns else pd.Series(0.0, index=report.index)
    score = score.fillna(0.0).clip(lower=0.0, upper=1.0)

    # Signal strength (optional - if no signal column, use 0.5 as neutral)
    if "signal" in report.columns:
        sig_map = {"both": 1.0, "breakout": 0.8, "pullback": 0.6, "none": 0.0}
        sig_strength = report["signal"].map(sig_map).fillna(0.5).clip(lower=0.0, upper=1.0)
    else:
        sig_strength = pd.Series(0.5, index=report.index)

    if "dist_sma200_pct" in report.columns:
        trend_strength = (report["dist_sma200_pct"].clip(lower=0.0) / 20.0).clip(
            lower=0.0, upper=1.0
        )
        trend_strength = trend_strength.fillna(0.0)
    else:
        trend_strength = pd.Series(0.0, index=report.index)

    if "atr_pct" in report.columns and max_atr_pct > 0:
        vol_strength = (1.0 - (report["atr_pct"] / max_atr_pct)).clip(
            lower=0.0, upper=1.0
        )
        vol_strength = vol_strength.fillna(0.0)
    else:
        vol_strength = pd.Series(0.0, index=report.index)

    conf = 100.0 * (
        0.50 * score + 0.25 * sig_strength + 0.15 * trend_strength + 0.10 * vol_strength
    )
    conf = conf.round(1)
    return conf


def build_momentum_report(
    ohlcv: pd.DataFrame,
    cfg: ReportConfig,
    exclude_tickers: Iterable[str] | None = None,
) -> pd.DataFrame:
    """
    Pipeline:
      eligible_universe -> ranking top_n -> signals -> trade plans -> merged report
    """
    univ = eligible_universe(ohlcv, cfg.universe)
    if univ is None or univ.empty:
        return pd.DataFrame()

    exclude = _normalize_ticker_set(exclude_tickers)
    if exclude:
        univ = univ.drop(index=list(exclude), errors="ignore")
        if univ.empty:
            return pd.DataFrame()

    ranked = top_candidates(univ, cfg.ranking)
    if ranked.empty:
        return pd.DataFrame()

    tickers = ranked.index.tolist()
    board = build_signal_board(ohlcv, tickers, cfg.signals)

    atr_col = f"atr{cfg.universe.vol.atr_window}"

    plans = build_trade_plans(
        ranked,
        board,
        cfg.risk,
        atr_col=atr_col,
    )

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

    # confidence score for active signals only
    report["confidence"] = _compute_confidence(report, cfg.universe.filt.max_atr_pct)

    # tidy columns order
    ma_col = f"ma{cfg.signals.pullback_ma}_level"
    keep = [
        "rank", "score", "confidence",
        "last", "currency", atr_col, "atr_pct",
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


@dataclass(frozen=True)
class MomentumStrategyModule:
    name: str = "momentum"

    def build_report(
        self,
        ohlcv: pd.DataFrame,
        cfg: ReportConfig,
        exclude_tickers: Iterable[str] | None = None,
    ) -> pd.DataFrame:
        return build_momentum_report(ohlcv, cfg=cfg, exclude_tickers=exclude_tickers)
