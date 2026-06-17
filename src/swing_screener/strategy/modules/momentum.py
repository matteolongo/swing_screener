from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import pandas as pd

from swing_screener.strategy.report_config import ReportConfig
from swing_screener.selection.ranking import top_candidates
from swing_screener.selection.entries import build_signal_board
from swing_screener.indicators.setup_quality import compute_setup_quality
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


def _non_feature_columns(columns: Iterable[str], cfg: ReportConfig) -> list[str]:
    """Columns contributed by the signal board / setup quality stages.

    These are excluded when ranking so the cross-sectional score matches the
    original pipeline, where ranking ran on the eligible feature table before
    signals and setup quality were joined.
    """
    lookback = cfg.signals.breakout_lookback
    ma = cfg.signals.pullback_ma
    board_cols = {
        "last",  # collides with feature ``last`` -> appears as ``last_sig``
        f"breakout{lookback}",
        "breakout_level",
        f"pullback_ma{ma}",
        f"ma{ma}_level",
        "signal",
        "breakout_volume_confirmation",
    }
    setup_cols = {
        "consolidation_tightness",
        "close_location_in_range",
        "above_breakout_extension",
        "breakout_volume_confirmation",
        "dist_52w_high_pct",
        "near_52w_high",
        "volume_ratio",
        "avg_daily_volume_eur",
    }
    non_feature = board_cols | setup_cols | {"last_sig"}
    out: list[str] = []
    for c in columns:
        if c in non_feature or c.endswith("_sig") or c.endswith("_sq"):
            out.append(c)
    return out


def compute_symbol_records(
    ohlcv: pd.DataFrame,
    cfg: ReportConfig,
    sector_benchmark_returns: dict[str, float] | None = None,
) -> pd.DataFrame:
    """Universe-independent per-symbol evaluation row for every ticker in ``ohlcv``.

    Joins the universe feature table (incl. ``is_eligible``) with the entry signal
    board and setup-quality features. Cross-sectional ranking is NOT applied here.
    """
    from swing_screener.selection.universe import build_universe

    feats = build_universe(
        ohlcv, cfg.universe, sector_benchmark_returns=sector_benchmark_returns
    )
    if feats is None or feats.empty:
        return pd.DataFrame()

    tickers = [str(t) for t in feats.index]
    board = build_signal_board(ohlcv, tickers, cfg.signals)
    setup = compute_setup_quality(ohlcv, tickers)

    records = feats.join(board, how="left", rsuffix="_sig")
    if setup is not None and not setup.empty:
        records = records.join(setup, how="left", rsuffix="_sq")
    return records


def build_momentum_report(
    ohlcv: pd.DataFrame,
    cfg: ReportConfig,
    exclude_tickers: Iterable[str] | None = None,
    sector_benchmark_returns: dict[str, float] | None = None,
    records: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Cross-sectional assembly over per-symbol records.

    When ``records`` is provided (e.g. from the eval cache), the per-symbol stage
    is skipped; otherwise it is computed via :func:`compute_symbol_records`.
    """
    if records is None:
        records = compute_symbol_records(
            ohlcv, cfg, sector_benchmark_returns=sector_benchmark_returns
        )
    if records is None or records.empty:
        return pd.DataFrame()

    exclude = _normalize_ticker_set(exclude_tickers)
    if exclude:
        records = records.drop(index=list(exclude), errors="ignore")

    eligible = records[records["is_eligible"]] if "is_eligible" in records.columns else records
    if eligible.empty:
        return pd.DataFrame()
    eligible = eligible.sort_values(["mom_6m", "rs_6m"], ascending=False)

    # Rank on the universe-feature columns only. In the original pipeline,
    # ranking ran on the eligible feature table *before* the signal board and
    # setup-quality features were joined, so optional ranking terms and the
    # extension penalty that read those columns (w_setup_quality,
    # above_breakout_extension, ...) were inert. Hiding the board/setup columns
    # here preserves that behaviour exactly.
    rank_input = eligible.drop(
        columns=_non_feature_columns(eligible.columns, cfg), errors="ignore"
    )
    ranked_scored = top_candidates(rank_input, cfg.ranking)
    if ranked_scored.empty:
        return pd.DataFrame()

    tickers = ranked_scored.index.tolist()
    # ``ranked`` carries score/rank from ranking plus the full per-symbol record
    # (features + signal board + setup quality) sliced to the top-N candidates.
    board = records.loc[records.index.intersection(tickers)]
    ranked = ranked_scored[["score", "rank"]].join(board, how="left")
    ranked = ranked.loc[tickers]

    atr_col = f"atr{cfg.universe.vol.atr_window}"

    plans = build_trade_plans(
        ranked,
        board,
        cfg.risk,
        atr_col=atr_col,
    )

    report = ranked

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
        "mom_6m", "mom_12m", "rs_6m", "sector_rs_6m",
        "sma20_slope", "sma50_slope",
        "trend_ok", "dist_sma50_pct", "dist_sma200_pct",
        "weekly_trend",
        "signal",
        "breakout_level", ma_col,
        "consolidation_tightness", "close_location_in_range",
        "above_breakout_extension", "breakout_volume_confirmation",
        "dist_52w_high_pct", "near_52w_high",
        "volume_ratio", "avg_daily_volume_eur",
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
        sector_benchmark_returns: dict[str, float] | None = None,
    ) -> pd.DataFrame:
        return build_momentum_report(
            ohlcv,
            cfg=cfg,
            exclude_tickers=exclude_tickers,
            sector_benchmark_returns=sector_benchmark_returns,
            records=None,
        )
