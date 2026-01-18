from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional, Dict, Any, List

import pandas as pd


EntryType = Literal["breakout", "pullback"]
ExitType = Literal["stop", "take_profit", "time"]


@dataclass(frozen=True)
class BacktestConfig:
    entry_type: EntryType = "pullback"
    breakout_lookback: int = 50
    pullback_ma: int = 20

    atr_window: int = 14
    k_atr: float = 2.0

    take_profit_R: float = 2.0
    max_holding_days: int = 20

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
    - Take profit = entry + take_profit_R * (entry - stop).
    - Exit priority each day (using bar-based holding period):
        1) Stop (includes gap-down fills at open)
        2) Take profit (includes gap-up fills at open)
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

    trades: List[Dict[str, Any]] = []

    in_pos = False
    entry_date = None
    entry_idx = None
    entry_price = None
    stop = None
    tp = None

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
                risk = entry_price - stop
                if risk <= 0:
                    continue

                tp = entry_price + cfg.take_profit_R * risk
                in_pos = True
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
        elif open_i >= tp:
            exit_type = "take_profit"
            exit_price = open_i
        elif low_i <= stop:
            exit_type = "stop"
            exit_price = float(stop)
        elif high_i >= tp:
            exit_type = "take_profit"
            exit_price = float(tp)
        elif holding_bars >= cfg.max_holding_days:
            exit_type = "time"
            exit_price = float(close_i)

        if exit_type is not None:
            commission_cost = cfg.commission_pct * (entry_price + exit_price)
            R = (exit_price - entry_price - commission_cost) / (entry_price - stop)
            trades.append(
                {
                    "ticker": ticker,
                    "entry_date": entry_date,
                    "exit_date": date,
                    "entry": round(entry_price, 4),
                    "stop": round(float(stop), 4),
                    "tp": round(float(tp), 4),
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
            tp = None

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
