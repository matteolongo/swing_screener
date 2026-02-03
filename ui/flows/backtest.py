from __future__ import annotations

import pandas as pd

from swing_screener.data.market_data import MarketDataConfig, fetch_ohlcv
from swing_screener.data.universe import UniverseConfig as DataUniverseConfig, load_universe_from_package
from swing_screener.backtest.portfolio import (
    backtest_portfolio_R,
    equity_curve_R,
    drawdown_stats,
    PortfolioBacktestConfig,
)
from swing_screener.backtest.simulator import BacktestConfig


def run_backtest(
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
    trades_all, summary_by_ticker, summary_total = backtest_portfolio_R(
        ohlcv, tickers, portfolio_cfg
    )
    curve = equity_curve_R(trades_all)
    dd = drawdown_stats(curve)

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
