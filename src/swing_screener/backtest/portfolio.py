from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Tuple
import warnings

import pandas as pd

from swing_screener.backtest.simulator import (
    BacktestConfig,
    backtest_single_ticker_R,
    summarize_trades,
)


@dataclass(frozen=True)
class PortfolioBacktestConfig:
    bt: BacktestConfig = BacktestConfig()
    min_trades_per_ticker: int = 3


def backtest_portfolio_R(
    ohlcv: pd.DataFrame,
    tickers: Iterable[str],
    cfg: PortfolioBacktestConfig = PortfolioBacktestConfig(),
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Returns:
      - trades_all (all tickers)
      - summary_by_ticker
      - summary_total
    """
    tks = [str(t).strip().upper() for t in tickers if t and str(t).strip()]
    tks = [t for i, t in enumerate(tks) if t not in tks[:i]]

    trades_list = []
    summaries = []

    for t in tks:
        try:
            tr = backtest_single_ticker_R(ohlcv, t, cfg.bt)
        except Exception as e:
            warnings.warn(
                f"Backtest failed for {t}: {e}",
                RuntimeWarning,
            )
            tr = pd.DataFrame()

        if tr is None or tr.empty:
            continue

        trades_list.append(tr)

        s = summarize_trades(tr)
        s.insert(0, "ticker", t)
        summaries.append(s)

    if not trades_list:
        empty = pd.DataFrame()
        return empty, empty, summarize_trades(pd.DataFrame())

    trades_all = pd.concat(trades_list, ignore_index=True)
    summary_by_ticker = pd.concat(summaries, ignore_index=True)

    summary_by_ticker = summary_by_ticker[
        summary_by_ticker["trades"] >= cfg.min_trades_per_ticker
    ]
    summary_by_ticker = summary_by_ticker.sort_values(
        "expectancy_R", ascending=False
    ).reset_index(drop=True)

    summary_total = summarize_trades(trades_all)
    return trades_all, summary_by_ticker, summary_total


def equity_curve_R(trades_all: pd.DataFrame) -> pd.DataFrame:
    """
    Cumulative R over time (grouped by exit_date).
    """
    if trades_all is None or trades_all.empty:
        return pd.DataFrame(columns=["date", "R", "cum_R"])

    df = trades_all.copy()
    df["date"] = pd.to_datetime(df["exit_date"])
    df = df.sort_values("date")

    curve = df.groupby("date")["R"].sum().reset_index()
    curve["cum_R"] = curve["R"].cumsum()
    return curve[["date", "R", "cum_R"]]


def drawdown_stats(curve: pd.DataFrame) -> dict:
    """
    Returns drawdown statistics from an equity curve in R units.
    """
    if curve is None or curve.empty or "cum_R" not in curve.columns:
        return {"max_drawdown_R": None}

    dd = curve["cum_R"] - curve["cum_R"].cummax()
    max_dd = float(dd.min())
    return {"max_drawdown_R": max_dd}
