from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional, Dict, Any, List

import pandas as pd


EntryType = Literal["breakout", "pullback"]
ExitType = Literal["stop", "take_profit", "time"]
ExitMode = Literal["take_profit", "trailing_stop"]


@dataclass(frozen=True)
class BacktestConfig:
    entry_type: EntryType = "pullback"
    breakout_lookback: int = 50
    pullback_ma: int = 20

    atr_window: int = 14
    k_atr: float = 2.0

    exit_mode: ExitMode = "take_profit"
    take_profit_R: float = 2.0
    max_holding_days: int = 20
    breakeven_at_R: float = 1.0
    trail_sma: int = 20
    trail_after_R: float = 2.0
    sma_buffer_pct: float = 0.005

    min_history: int = 260  # for daily swing
    commission_pct: float = 0.0  # per-side commission as % of price


def _sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n, min_periods=n).mean()


def _atr(high: pd.Series, low: pd.Series, close: pd.Series, n: int = 14) -> pd.Series:
    prev_close = close.shift(1)
    tr = pd.concat(
        [(high - low), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.rolling(n, min_periods=n).mean()


def _entry_signal(close: pd.Series, cfg: BacktestConfig) -> pd.Series:
    """
    Boolean Series: True on entry bars.
    Entry executes at close of the signal bar (simple baseline).
    """
    if cfg.entry_type == "breakout":
        prior_high = close.rolling(cfg.breakout_lookback).max().shift(1)
        return close > prior_high

    ma = _sma(close, cfg.pullback_ma)
    return (close.shift(1) < ma.shift(1)) & (close > ma)


def backtest_single_ticker_R(
    ohlcv: pd.DataFrame,
    ticker: str,
    cfg: BacktestConfig = BacktestConfig(),
) -> pd.DataFrame:
    """
    Backtest one ticker in R units.

    Rules:
    - Signals computed on completed bars; entry at next bar's open.
    - Stop = entry - k_atr * ATR (ATR from prior bar).
    - Exit modes:
        * take_profit: TP = entry + take_profit_R * (entry - stop)
        * trailing_stop: no TP; stop can move to breakeven and trail under SMA
          (updates apply from next bar to avoid look-ahead).
    - Exit priority each day (using bar-based holding period):
        1) Stop (includes gap-down fills at open)
        2) Take profit (if enabled; includes gap-up fills at open)
        3) Time stop (max_holding_days in bars)
    - Optional per-side commission_pct is applied on both entry and exit.
    """
    if not isinstance(ohlcv.columns, pd.MultiIndex):
        raise ValueError("ohlcv must have MultiIndex columns (field, ticker).")

    for field in ["Open", "High", "Low", "Close"]:
        if field not in ohlcv.columns.get_level_values(0):
            raise ValueError(f"Missing field {field} in ohlcv.")

    if ticker not in ohlcv["Close"].columns:
        raise ValueError(f"{ticker} not found in ohlcv Close columns.")

    df = pd.DataFrame(
        {
            "open": ohlcv["Open"][ticker],
            "high": ohlcv["High"][ticker],
            "low": ohlcv["Low"][ticker],
            "close": ohlcv["Close"][ticker],
        }
    ).dropna()

    if len(df) < cfg.min_history:
        return pd.DataFrame()

    df["atr"] = _atr(df["high"], df["low"], df["close"], cfg.atr_window)
    df["atr_prev"] = df["atr"].shift(1)
    df["entry_sig"] = _entry_signal(df["close"], cfg).shift(1)
    if cfg.exit_mode == "trailing_stop":
        df["trail_sma"] = _sma(df["close"], cfg.trail_sma)

    trades: List[Dict[str, Any]] = []

    in_pos = False
    entry_date = None
    entry_idx = None
    entry_price = None
    stop = None
    stop_init = None
    risk_per_share = None
    tp = None

    def _maybe_trail_stop(
        stop_current: float,
        close_val: float,
        sma_val: float,
    ) -> float:
        r_now = (close_val - entry_price) / float(risk_per_share)
        stop_candidate = float(stop_current)

        if r_now >= cfg.breakeven_at_R:
            stop_candidate = max(stop_candidate, float(entry_price))

        if r_now >= cfg.trail_after_R and not pd.isna(sma_val):
            trail_stop = sma_val * (1.0 - cfg.sma_buffer_pct)
            stop_candidate = max(stop_candidate, trail_stop)

        return float(stop_candidate)

    for i in range(len(df)):
        date = df.index[i]

        if not in_pos:
            if bool(df["entry_sig"].iloc[i]):
                atr_i = df["atr_prev"].iloc[i]
                if pd.isna(atr_i) or atr_i <= 0:
                    continue

                entry_date = date
                entry_idx = i
                entry_price = float(df["open"].iloc[i])

                stop = entry_price - cfg.k_atr * float(atr_i)
                stop_init = float(stop)
                risk_per_share = float(entry_price - stop_init)
                if risk_per_share <= 0:
                    continue

                if cfg.exit_mode == "take_profit":
                    tp = entry_price + cfg.take_profit_R * risk_per_share
                else:
                    tp = None
                in_pos = True

                if cfg.exit_mode == "trailing_stop":
                    sma_val = float(df["trail_sma"].iloc[i])
                    stop = _maybe_trail_stop(float(stop), float(df["close"].iloc[i]), sma_val)
            continue

        # In position: evaluate exit
        open_i = float(df["open"].iloc[i])
        high_i = float(df["high"].iloc[i])
        low_i = float(df["low"].iloc[i])
        close_i = float(df["close"].iloc[i])

        holding_bars = i - entry_idx

        exit_type: Optional[ExitType] = None
        exit_price: Optional[float] = None

        # Gap handling: exits at open if price gaps through levels.
        if open_i <= stop:
            exit_type = "stop"
            exit_price = open_i
        elif cfg.exit_mode == "take_profit" and tp is not None and open_i >= tp:
            exit_type = "take_profit"
            exit_price = open_i
        elif low_i <= stop:
            exit_type = "stop"
            exit_price = float(stop)
        elif cfg.exit_mode == "take_profit" and tp is not None and high_i >= tp:
            exit_type = "take_profit"
            exit_price = float(tp)
        elif holding_bars >= cfg.max_holding_days:
            exit_type = "time"
            exit_price = float(close_i)

        if exit_type is not None:
            commission_cost = cfg.commission_pct * (entry_price + exit_price)
            R = (exit_price - entry_price - commission_cost) / float(risk_per_share)
            trades.append(
                {
                    "ticker": ticker,
                    "entry_date": entry_date,
                    "exit_date": date,
                    "entry": round(entry_price, 4),
                    "stop": round(float(stop_init), 4),
                    "tp": round(float(tp), 4) if tp is not None else None,
                    "exit": round(float(exit_price), 4),
                    "exit_type": exit_type,
                    "R": round(float(R), 4),
                    "holding_days": int(holding_bars),
                    "entry_type": cfg.entry_type,
                }
            )

            in_pos = False
            entry_date = None
            entry_idx = None
            entry_price = None
            stop = None
            stop_init = None
            risk_per_share = None
            tp = None
            continue

        if cfg.exit_mode == "trailing_stop":
            sma_val = float(df["trail_sma"].iloc[i])
            stop_candidate = _maybe_trail_stop(float(stop), close_i, sma_val)
            if stop_candidate > stop + 1e-9:
                stop = float(stop_candidate)

    return pd.DataFrame(trades)


def summarize_trades(trades: pd.DataFrame) -> pd.DataFrame:
    if trades is None or trades.empty:
        return pd.DataFrame(
            [
                {
                    "trades": 0,
                    "winrate": None,
                    "avg_R": None,
                    "median_R": None,
                    "expectancy_R": None,
                    "profit_factor_R": None,
                }
            ]
        )

    r = trades["R"]
    wins = r[r > 0]
    losses = r[r <= 0]

    winrate = float((r > 0).mean())
    avg_R = float(r.mean())
    med_R = float(r.median())

    profit_factor = None
    if losses.abs().sum() > 0:
        profit_factor = float(wins.sum() / losses.abs().sum())

    return pd.DataFrame(
        [
            {
                "trades": int(len(trades)),
                "winrate": round(winrate, 4),
                "avg_R": round(avg_R, 4),
                "median_R": round(med_R, 4),
                "expectancy_R": round(avg_R, 4),
                "profit_factor_R": (
                    round(profit_factor, 4) if profit_factor is not None else None
                ),
            }
        ]
    )
