from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Iterable

import pandas as pd

from swing_screener.strategy.report_config import ReportConfig
from swing_screener.selection.eval_cache import strategy_signature
from swing_screener.selection.ranking import top_candidates
from swing_screener.selection.universe import build_universe
from swing_screener.selection.entries import build_signal_board
from swing_screener.indicators.setup_quality import compute_setup_quality
from swing_screener.risk.position_sizing import build_trade_plans
from swing_screener.execution.guidance import add_execution_guidance

# Marker column persisted in the per-symbol records frame holding the JSON list
# of universe feature-table columns. Ranking must run only on those columns so
# the cross-sectional score matches the original pipeline, where ranking ran on
# the eligible feature table *before* the signal board and setup-quality columns
# were joined. Storing the list in the records (and thus in the parquet cache)
# makes this an allowlist that auto-excludes any future board/setup column,
# rather than a denylist that fails open on a new, uniquely-named column.
_FEATURE_COLS_MARKER = "__feature_cols__"


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


def _ranking_input(eligible: pd.DataFrame) -> pd.DataFrame:
    """Restrict ranking to the universe feature-table columns.

    The set of feature columns is read from the :data:`_FEATURE_COLS_MARKER`
    column when present (always set by :func:`compute_symbol_records`, and
    preserved across the parquet cache). When absent — e.g. synthetic records
    injected directly in tests — ranking falls back to all columns.
    """
    if _FEATURE_COLS_MARKER in eligible.columns and not eligible.empty:
        raw = eligible[_FEATURE_COLS_MARKER].iloc[0]
        feature_cols = json.loads(raw) if isinstance(raw, str) else list(raw)
        cols = [c for c in feature_cols if c in eligible.columns]
        return eligible[cols]
    return eligible.drop(columns=[_FEATURE_COLS_MARKER], errors="ignore")


def compute_symbol_records(
    ohlcv: pd.DataFrame,
    cfg: ReportConfig,
    sector_benchmark_returns: dict[str, float] | None = None,
) -> pd.DataFrame:
    """Universe-independent per-symbol evaluation row for every ticker in ``ohlcv``.

    Joins the universe feature table (incl. ``is_eligible``) with the entry signal
    board and setup-quality features. Cross-sectional ranking is NOT applied here.
    The feature-table column names are recorded in :data:`_FEATURE_COLS_MARKER`
    so ranking can later run on exactly those columns.
    """
    feats = build_universe(
        ohlcv, cfg.universe, sector_benchmark_returns=sector_benchmark_returns
    )
    if feats is None or feats.empty:
        return pd.DataFrame()

    feature_cols = [str(c) for c in feats.columns]
    tickers = [str(t) for t in feats.index]
    board = build_signal_board(ohlcv, tickers, cfg.signals)
    setup = compute_setup_quality(ohlcv, tickers)

    records = feats.join(board, how="left", rsuffix="_sig")
    if setup is not None and not setup.empty:
        records = records.join(setup, how="left", rsuffix="_sq")
    records[_FEATURE_COLS_MARKER] = json.dumps(feature_cols)
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
    sort_cols = [c for c in ["mom_6m", "rs_6m"] if c in eligible.columns]
    eligible = eligible.sort_values(sort_cols, ascending=False) if sort_cols else eligible

    # Rank on the universe-feature columns only (see ``_ranking_input``). In the
    # original pipeline ranking ran on the eligible feature table *before* the
    # signal board and setup-quality features were joined, so the setup-derived
    # ranking terms (the ``above_breakout_extension`` extension penalty and the
    # optional ``w_setup_quality`` inputs ``consolidation_tightness`` /
    # ``close_location_in_range``) were inert. Restricting the input to the
    # feature columns preserves that exactly. The marker column is then dropped
    # so it never reaches trade plans, the report, or the output projection.
    rank_input = _ranking_input(eligible)
    records = records.drop(columns=[_FEATURE_COLS_MARKER], errors="ignore")
    eligible = eligible.drop(columns=[_FEATURE_COLS_MARKER], errors="ignore")
    required_ranking_cols = {"mom_6m", "mom_12m", "rs_6m"}
    if not required_ranking_cols.issubset(rank_input.columns):
        return pd.DataFrame()
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
        cfg: ReportConfig = ReportConfig(),
        exclude_tickers: Iterable[str] | None = None,
        sector_benchmark_returns: dict[str, float] | None = None,
        eval_cache=None,
        asof_date: str | None = None,
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        if eval_cache is None or asof_date is None:
            return build_momentum_report(
                ohlcv,
                cfg=cfg,
                exclude_tickers=exclude_tickers,
                sector_benchmark_returns=sector_benchmark_returns,
            )
        sig = strategy_signature(cfg)
        level0 = ohlcv.columns.get_level_values(0)
        all_tickers = (
            [str(t) for t in ohlcv.columns.get_level_values(1)[level0 == "Close"]]
            if "Close" in set(level0)
            else []
        )
        if force_refresh:
            hits, misses = pd.DataFrame(), all_tickers
        else:
            hits, misses = eval_cache.split(all_tickers, asof=asof_date, sig=sig)
        miss_records = pd.DataFrame()
        if misses:
            miss_ohlcv = ohlcv.loc[:, ohlcv.columns.get_level_values(1).isin(misses)]
            miss_records = compute_symbol_records(miss_ohlcv, cfg, sector_benchmark_returns=sector_benchmark_returns)
            eval_cache.write(miss_records, asof=asof_date, sig=sig)
        frames = [f for f in (hits, miss_records) if f is not None and not f.empty]
        records = pd.concat(frames) if frames else pd.DataFrame()
        if not records.empty:
            records = records[~records.index.duplicated(keep="last")]
        return build_momentum_report(
            ohlcv,
            cfg=cfg,
            exclude_tickers=exclude_tickers,
            sector_benchmark_returns=sector_benchmark_returns,
            records=records,
        )
