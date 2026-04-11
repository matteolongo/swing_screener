from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

import pandas as pd
from swing_screener.utils.dataframe_helpers import get_close_matrix, sma
from swing_screener.settings import get_settings_manager


def _signal_defaults() -> dict:
    sel = get_settings_manager().get_low_level_defaults_payload("selection")
    d = sel.get("signals", {})
    return d if isinstance(d, dict) else {}


@dataclass(frozen=True)
class EntrySignalConfig:
    breakout_lookback: int = field(default_factory=lambda: int(_signal_defaults().get("breakout_lookback", 50)))
    pullback_ma: int = field(default_factory=lambda: int(_signal_defaults().get("pullback_ma", 20)))
    min_history: int = field(default_factory=lambda: int(_signal_defaults().get("min_history", 260)))


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

    ma = sma(close_s, ma_window)
    y = close_s.iloc[-2]
    t = close_s.iloc[-1]
    y_ma = ma.iloc[-2]
    t_ma = ma.iloc[-1]

    ok = (y < y_ma) and (t > t_ma)
    return bool(ok), float(t_ma)


def _get_volume_matrix(ohlcv: pd.DataFrame) -> pd.DataFrame | None:
    """Return the (date × ticker) volume DataFrame, or None if absent."""
    if not isinstance(ohlcv.columns, pd.MultiIndex):
        return None
    level0 = ohlcv.columns.get_level_values(0)
    for candidate in ("Volume", "volume", "VOLUME"):
        if candidate in level0:
            vol = ohlcv[candidate]
            return vol if isinstance(vol, pd.DataFrame) else vol.to_frame()
    return None


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
      - breakout_volume_confirmation (bool, optional — present when volume data available)
    """
    close = get_close_matrix(ohlcv)
    vol_matrix = _get_volume_matrix(ohlcv)

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

        row: dict = {
            "ticker": t,
            "last": last,
            breakout_col: brk,
            "breakout_level": brk_lvl,
            pullback_col: pb,
            ma_col: ma_lvl,
            "signal": sig,
        }

        # Volume confirmation: present only when volume data available
        if vol_matrix is not None and t in vol_matrix.columns:
            v = vol_matrix[t].dropna()
            if len(v) >= 21:
                today_vol = float(v.iloc[-1])
                avg_vol_20 = float(v.iloc[-21:-1].mean())
                row["breakout_volume_confirmation"] = bool(today_vol > 1.5 * avg_vol_20)

        rows.append(row)

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
