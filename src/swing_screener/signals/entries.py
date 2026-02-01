from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import pandas as pd


@dataclass(frozen=True)
class EntrySignalConfig:
    breakout_lookback: int = 50
    pullback_ma: int = 20
    min_history: int = 260


def _get_close_matrix(ohlcv: pd.DataFrame) -> pd.DataFrame:
    if not isinstance(ohlcv.columns, pd.MultiIndex):
        raise ValueError("OHLCV must have MultiIndex columns (field, ticker).")
    if "Close" not in ohlcv.columns.get_level_values(0):
        raise ValueError("Field 'Close' not found in OHLCV.")
    close = ohlcv["Close"].copy()
    if not isinstance(close, pd.DataFrame):
        close = close.to_frame()
    return close.sort_index()


def _sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n, min_periods=n).mean()


def breakout_signal(close_s: pd.Series, lookback: int) -> tuple[bool, float]:
    """
    Breakout if today's close > max(close) over previous `lookback` bars (excluding today).
    Returns: (is_breakout, breakout_level)
    """
    if len(close_s) < lookback + 2:
        return False, float("nan")

    prior_high = close_s.iloc[-(lookback + 1) : -1].max()
    return bool(close_s.iloc[-1] > prior_high), float(prior_high)


def pullback_reclaim_signal(close_s: pd.Series, ma_window: int) -> tuple[bool, float]:
    """
    Pullback reclaim if yesterday close < MA and today close > MA.
    Returns: (is_pullback, ma_today)
    """
    if len(close_s) < ma_window + 5:
        return False, float("nan")

    ma = _sma(close_s, ma_window)
    y = close_s.iloc[-2]
    t = close_s.iloc[-1]
    y_ma = ma.iloc[-2]
    t_ma = ma.iloc[-1]

    ok = (y < y_ma) and (t > t_ma)
    return bool(ok), float(t_ma)


def build_signal_board(
    ohlcv: pd.DataFrame,
    tickers: Iterable[str],
    cfg: EntrySignalConfig = EntrySignalConfig(),
) -> pd.DataFrame:
    """
    Returns DataFrame indexed by ticker with:
      - last
      - breakout{lookback} (bool) + breakout_level
      - pullback_ma{ma} (bool) + ma{ma}_level
      - signal in {'both','breakout','pullback','none'}
    """
    close = _get_close_matrix(ohlcv)

    tks = [str(t).strip().upper() for t in tickers if t and str(t).strip()]
    tks = [t for i, t in enumerate(tks) if t not in tks[:i]]  # unique preserve order

    breakout_col = f"breakout{cfg.breakout_lookback}"
    pullback_col = f"pullback_ma{cfg.pullback_ma}"
    ma_col = f"ma{cfg.pullback_ma}_level"

    rows = []
    for t in tks:
        if t not in close.columns:
            continue

        s = close[t].dropna()
        if s.empty:
            continue
        if len(s) < cfg.min_history:
            continue

        last = float(s.iloc[-1])

        brk, brk_lvl = breakout_signal(s, cfg.breakout_lookback)
        pb, ma_lvl = pullback_reclaim_signal(s, cfg.pullback_ma)

        if brk and pb:
            sig = "both"
        elif brk:
            sig = "breakout"
        elif pb:
            sig = "pullback"
        else:
            sig = "none"

        rows.append(
            {
                "ticker": t,
                "last": last,
                breakout_col: brk,
                "breakout_level": brk_lvl,
                pullback_col: pb,
                ma_col: ma_lvl,
                "signal": sig,
            }
        )

    board_cols = [
        "last",
        breakout_col,
        "breakout_level",
        pullback_col,
        ma_col,
        "signal",
    ]
    if not rows:
        return pd.DataFrame(columns=board_cols, index=pd.Index([], name="ticker"))

    board = pd.DataFrame(rows).set_index("ticker")

    # sort signals first
    order = {"both": 0, "breakout": 1, "pullback": 2, "none": 3}
    board["signal_order"] = board["signal"].map(order).fillna(99).astype(int)
    board = board.sort_values(["signal_order", "last"], ascending=[True, False]).drop(
        columns=["signal_order"]
    )

    return board
