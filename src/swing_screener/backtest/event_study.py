from __future__ import annotations

import math
from dataclasses import dataclass, replace
from typing import Iterable

import pandas as pd

from swing_screener.backtest.config import BacktestConfig
from swing_screener.backtest.ledger import Trade
from swing_screener.backtest.metrics import BacktestMetrics, compute_metrics
from swing_screener.execution.guidance import apply_pattern_stop
from swing_screener.indicators.candles import detect_patterns
from swing_screener.indicators.volatility import compute_atr_per_ticker
from swing_screener.portfolio.state import ManageConfig, Position, evaluate_positions
from swing_screener.risk.position_sizing import compute_stop
from swing_screener.selection.entries import build_signal_board

_SIGNAL_SETUPS = {"breakout", "pullback", "both"}


@dataclass(frozen=True)
class EventStudyResult:
    trades: list[Trade]
    metrics: BacktestMetrics


def run_event_study(
    ohlcv: pd.DataFrame,
    tickers: Iterable[str],
    config: BacktestConfig = BacktestConfig(),
) -> EventStudyResult:
    """Replay the live entry/stop/exit decision path over history for each ticker.

    For every bar T where the live screener fires a setup, open a simulated trade
    filled at the next bar's open, then advance the live portfolio manager
    (`evaluate_positions`) day by day until it exits. Trades never overlap on the
    same symbol: a new signal is only considered after the prior trade closes.
    """
    tks = [str(t).strip().upper() for t in tickers if t and str(t).strip()]
    tks = [t for i, t in enumerate(tks) if t not in tks[:i]]

    trades: list[Trade] = []
    for ticker in tks:
        trades.extend(_study_ticker(ohlcv, ticker, config))
    return EventStudyResult(trades=trades, metrics=compute_metrics(trades))


def _study_ticker(
    ohlcv: pd.DataFrame, ticker: str, config: BacktestConfig
) -> list[Trade]:
    close_m = ohlcv["Close"]
    if ticker not in close_m.columns:
        return []

    n = len(ohlcv.index)
    high_s = ohlcv["High"][ticker]
    low_s = ohlcv["Low"][ticker]
    close_s = ohlcv["Close"][ticker]
    open_s = ohlcv["Open"][ticker]

    out: list[Trade] = []
    i = 0
    while i < n - 1:  # need at least one forward bar to fill the entry
        window_t = ohlcv.iloc[: i + 1]
        board = build_signal_board(window_t, [ticker], config.entry)
        if ticker not in board.index:
            i += 1
            continue
        setup = str(board.loc[ticker, "signal"])
        if setup not in _SIGNAL_SETUPS:
            i += 1
            continue

        fill = float(open_s.iloc[i + 1])
        if not math.isfinite(fill) or fill <= 0:
            i += 1
            continue

        atr = compute_atr_per_ticker(
            high_s.iloc[: i + 1],
            low_s.iloc[: i + 1],
            close_s.iloc[: i + 1],
            config.atr_window,
        )
        if not math.isfinite(atr) or atr <= 0:
            i += 1
            continue

        stop = compute_stop(fill, atr, config.k_atr)
        pattern_fired = False
        if config.execution.pattern_stop_enabled:
            patterns = detect_patterns(window_t, [ticker], cfg=config.candles)
            pstop, _reason = apply_pattern_stop(
                ticker=ticker,
                entry=fill,
                current_stop=stop,
                atr=atr,
                patterns=patterns,
                buffer_atr=config.execution.pattern_stop_atr_buffer,
                min_rr_stop=None,
            )
            if pstop is not None:
                stop = pstop
                pattern_fired = True

        initial_risk = fill - stop
        if initial_risk <= 0:
            i += 1
            continue

        entry_idx = i + 1
        entry_date = str(ohlcv.index[entry_idx].date())
        pos = Position(
            ticker=ticker,
            status="open",
            entry_date=entry_date,
            entry_price=fill,
            stop_price=stop,
            shares=1,
            initial_risk=round(float(initial_risk), 4),
            max_favorable_price=fill,
        )

        exit_idx, exit_price, exit_reason, mfe_r, mae_r = _simulate_forward(
            ohlcv, ticker, pos, entry_idx, config.manage
        )

        r_multiple = (exit_price - fill) / initial_risk
        out.append(
            Trade(
                ticker=ticker,
                setup=setup,
                entry_date=entry_date,
                entry_price=round(fill, 4),
                initial_stop=round(float(stop), 4),
                initial_risk=round(float(initial_risk), 4),
                target=round(fill + config.rr_target * initial_risk, 4),
                exit_date=str(ohlcv.index[exit_idx].date()),
                exit_price=round(float(exit_price), 4),
                exit_reason=exit_reason,
                r_multiple=round(float(r_multiple), 4),
                bars_held=exit_idx - entry_idx + 1,
                mfe_r=round(float(mfe_r), 4),
                mae_r=round(float(mae_r), 4),
                pattern_stop_fired=pattern_fired,
            )
        )

        i = exit_idx + 1  # non-overlapping: resume only after the trade closes

    return out


def _simulate_forward(
    ohlcv: pd.DataFrame,
    ticker: str,
    pos: Position,
    entry_idx: int,
    manage: ManageConfig,
) -> tuple[int, float, str, float, float]:
    """Advance the live portfolio manager bar by bar until it signals an exit.

    Returns (exit_idx, exit_price, exit_reason, mfe_r, mae_r). A stop hit fills at
    the stop level; time/exit-signal exits fill at that bar's close. If the trade
    never closes within the data, it is censored (`open`) at the last bar.
    """
    n = len(ohlcv.index)
    close_s = ohlcv["Close"][ticker]
    risk = float(pos.initial_risk)
    mfe_r = 0.0
    mae_r = 0.0
    cur = pos

    for j in range(entry_idx, n):
        last_close = float(close_s.iloc[j])
        if math.isfinite(last_close):
            r = (last_close - pos.entry_price) / risk
            mfe_r = max(mfe_r, r)
            mae_r = min(mae_r, r)

        window_j = ohlcv.iloc[: j + 1]
        updates, new_positions = evaluate_positions(window_j, [cur], manage)
        u = updates[0]

        if u.action == "CLOSE_STOP_HIT":
            return j, cur.stop_price, "stop_hit", mfe_r, mae_r
        if u.action == "CLOSE_TIME_EXIT":
            return j, last_close, "time_exit", mfe_r, mae_r
        if u.action == "CLOSE_EXIT_SIGNAL":
            return j, last_close, "exit_signal", mfe_r, mae_r
        if u.action == "MOVE_STOP_UP":
            cur = replace(new_positions[0], stop_price=float(u.stop_suggested))
        else:
            cur = new_positions[0]

    last_close = float(close_s.iloc[n - 1])
    return n - 1, last_close, "open", mfe_r, mae_r
