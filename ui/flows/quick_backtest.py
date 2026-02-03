from __future__ import annotations

import pandas as pd

from swing_screener.data.market_data import MarketDataConfig, fetch_ohlcv
from swing_screener.backtest.simulator import (
    BacktestConfig,
    backtest_single_ticker_R,
    summarize_trades,
)
from swing_screener.backtest.portfolio import equity_curve_R, drawdown_stats


def build_bt_config_from_settings(
    settings: dict, *, min_history: int | None = None
) -> BacktestConfig:
    return BacktestConfig(
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


def run_quick_backtest_single(
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
        warnings.append(
            f"Not enough bars for ATR window ({bars} < {cfg.atr_window + 1})."
        )
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
        "curve": curve,
        "warnings": warnings,
    }
