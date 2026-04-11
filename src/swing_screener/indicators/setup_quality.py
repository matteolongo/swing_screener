"""Setup quality indicators — measures of base quality, range position, and extension.

All functions accept a MultiIndex (field, ticker) OHLCV DataFrame and return a
per-ticker snapshot DataFrame. Missing inputs produce NaN for that column only;
they never raise.
"""
from __future__ import annotations

from typing import Iterable

import pandas as pd


def _get_field(ohlcv: pd.DataFrame, field: str) -> pd.DataFrame | None:
    """Return the (date × ticker) sub-DataFrame for *field*, or None if absent."""
    if not isinstance(ohlcv.columns, pd.MultiIndex):
        return None
    level0 = ohlcv.columns.get_level_values(0)
    # Try exact match then title-case (e.g. "close" / "Close")
    for candidate in (field, field.title(), field.upper(), field.lower()):
        if candidate in level0:
            df = ohlcv[candidate]
            return df if isinstance(df, pd.DataFrame) else df.to_frame()
    return None


def compute_setup_quality(
    ohlcv: pd.DataFrame,
    tickers: Iterable[str] | None = None,
) -> pd.DataFrame:
    """Compute setup quality features per ticker.

    Returns DataFrame indexed by ticker with columns:
      - ``consolidation_tightness``:   1 − (atr14 / atr63) clamped [0, 1].
                                       Higher = tighter base (ATR has contracted).
      - ``close_location_in_range``:   (close − low_20) / (high_20 − low_20) clamped [0, 1].
                                       Higher = closing near top of 20-bar range.
      - ``above_breakout_extension``:  max(0, (close / prior_high_50) − 1).
                                       Positive value = chasing above 50-bar high.
      - ``breakout_volume_confirmation``: True if the last close-day volume is > 1.5×
                                          the 20-bar average volume. Absent when volume
                                          data is unavailable.

    Any column whose inputs are insufficient is NaN for that ticker.
    """
    close_m = _get_field(ohlcv, "Close")
    high_m = _get_field(ohlcv, "High")
    low_m = _get_field(ohlcv, "Low")
    vol_m = _get_field(ohlcv, "Volume")

    if close_m is None or close_m.empty:
        return pd.DataFrame(
            columns=["consolidation_tightness", "close_location_in_range", "above_breakout_extension"],
            index=pd.Index([], name="ticker"),
        )

    all_tickers = close_m.columns.tolist()
    if tickers is not None:
        tk_set = {str(t).strip().upper() for t in tickers if t and str(t).strip()}
        all_tickers = [t for t in all_tickers if str(t).strip().upper() in tk_set]

    rows = []
    for ticker in all_tickers:
        if ticker not in close_m.columns:
            continue

        c = close_m[ticker].dropna()
        h = high_m[ticker].dropna() if high_m is not None and ticker in high_m.columns else pd.Series(dtype=float)
        l = low_m[ticker].dropna() if low_m is not None and ticker in low_m.columns else pd.Series(dtype=float)

        if len(c) < 14:
            continue

        last_close = float(c.iloc[-1])
        row: dict = {"ticker": ticker}

        # ── consolidation_tightness ──────────────────────────────────────────
        ct = float("nan")
        if len(h) >= 77 and len(l) >= 77:
            # ATR14: simple mean of true range over most recent 14 bars
            h14 = h.iloc[-14:].values
            l14 = l.iloc[-14:].values
            c14 = c.iloc[-14:].values
            c14_prev = c.iloc[-15:-1].values
            tr14 = pd.DataFrame({
                "hl": h14 - l14,
                "hcp": abs(h14 - c14_prev),
                "lcp": abs(l14 - c14_prev),
            }).max(axis=1)
            atr14 = float(tr14.mean()) if not tr14.empty else float("nan")

            # ATR63: simple mean of true range over previous 63 bars
            h63 = h.iloc[-77:-14].values
            l63 = l.iloc[-77:-14].values
            c63 = c.iloc[-77:-14].values
            c63_prev = c.iloc[-78:-15].values
            tr63 = pd.DataFrame({
                "hl": h63 - l63,
                "hcp": abs(h63 - c63_prev),
                "lcp": abs(l63 - c63_prev),
            }).max(axis=1)
            atr63 = float(tr63.mean()) if not tr63.empty else float("nan")

            if pd.notna(atr14) and pd.notna(atr63) and atr63 > 0:
                ct = max(0.0, min(1.0, 1.0 - (atr14 / atr63)))
        row["consolidation_tightness"] = ct

        # ── close_location_in_range ─────────────────────────────────────────
        clr = float("nan")
        if len(h) >= 20 and len(l) >= 20:
            high_20 = float(h.iloc[-20:].max())
            low_20 = float(l.iloc[-20:].min())
            rng = high_20 - low_20
            if rng > 0:
                clr = max(0.0, min(1.0, (last_close - low_20) / rng))
        row["close_location_in_range"] = clr

        # ── above_breakout_extension ─────────────────────────────────────────
        ext = float("nan")
        if len(h) >= 51:
            prior_high_50 = float(h.iloc[-51:-1].max())
            if prior_high_50 > 0:
                ext = max(0.0, (last_close / prior_high_50) - 1.0)
        row["above_breakout_extension"] = ext

        # ── breakout_volume_confirmation (optional) ───────────────────────
        if vol_m is not None and ticker in vol_m.columns:
            v = vol_m[ticker].dropna()
            if len(v) >= 21:
                today_vol = float(v.iloc[-1])
                avg_vol_20 = float(v.iloc[-21:-1].mean())
                row["breakout_volume_confirmation"] = bool(today_vol > 1.5 * avg_vol_20)

        rows.append(row)

    if not rows:
        return pd.DataFrame(
            columns=["consolidation_tightness", "close_location_in_range", "above_breakout_extension"],
            index=pd.Index([], name="ticker"),
        )

    result = pd.DataFrame(rows).set_index("ticker")
    return result.sort_index()
