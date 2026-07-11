"""Setup quality indicators — measures of base quality, range position, and extension.

All functions accept a MultiIndex (field, ticker) OHLCV DataFrame and return a
per-ticker snapshot DataFrame. Missing inputs produce NaN for that column only;
they never raise.
"""
from __future__ import annotations

from typing import Iterable

import pandas as pd

from swing_screener.data.currency import detect_currency
from swing_screener.indicators.volume_pressure import windowed_buy_pressure_ratio


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


def _positive_rate(value) -> float | None:
    try:
        rate = float(value)
    except (TypeError, ValueError):
        return None
    return rate if pd.notna(rate) and rate > 0 else None


def _quote_to_eur_rate(
    ticker: str,
    quote_to_eur_rates: dict[str, float] | None,
) -> float | None:
    currency = str(detect_currency(str(ticker)) or "").strip().upper()
    if currency == "EUR":
        return 1.0
    if not quote_to_eur_rates:
        return None

    normalized = {
        str(key).strip().upper(): value
        for key, value in quote_to_eur_rates.items()
        if str(key).strip()
    }
    for key in (str(ticker).strip().upper(), currency):
        if key in normalized:
            return _positive_rate(normalized[key])
    return None


def compute_setup_quality(
    ohlcv: pd.DataFrame,
    tickers: Iterable[str] | None = None,
    *,
    quote_to_eur_rates: dict[str, float] | None = None,
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
            columns=["consolidation_tightness", "close_location_in_range", "above_breakout_extension", "dist_52w_high_pct", "near_52w_high"],
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

        c_raw = close_m[ticker]
        h_raw = high_m[ticker] if high_m is not None and ticker in high_m.columns else None
        l_raw = low_m[ticker] if low_m is not None and ticker in low_m.columns else None
        v_raw = vol_m[ticker] if vol_m is not None and ticker in vol_m.columns else None

        c = c_raw.dropna()
        ohlc = (
            pd.concat({"h": h_raw, "l": l_raw, "c": c_raw}, axis=1).dropna()
            if h_raw is not None and l_raw is not None
            else pd.DataFrame(columns=["h", "l", "c"])
        )

        if len(c) < 14:
            continue

        last_close = float(c.iloc[-1])
        row: dict = {"ticker": ticker}

        # ── consolidation_tightness ──────────────────────────────────────────
        ct = float("nan")
        if len(ohlc) >= 78:
            # ATR14: simple mean of true range over most recent 14 bars
            h = ohlc["h"]
            l = ohlc["l"]
            c_aligned = ohlc["c"]
            h14 = h.iloc[-14:].values
            l14 = l.iloc[-14:].values
            c14 = c_aligned.iloc[-14:].values
            c14_prev = c_aligned.iloc[-15:-1].values
            tr14 = pd.DataFrame({
                "hl": h14 - l14,
                "hcp": abs(h14 - c14_prev),
                "lcp": abs(l14 - c14_prev),
            }).max(axis=1)
            atr14 = float(tr14.mean()) if not tr14.empty else float("nan")

            # ATR63: simple mean of true range over previous 63 bars
            h63 = h.iloc[-77:-14].values
            l63 = l.iloc[-77:-14].values
            c63 = c_aligned.iloc[-77:-14].values
            c63_prev = c_aligned.iloc[-78:-15].values
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
        if len(ohlc) >= 20:
            window_20 = ohlc.iloc[-20:]
            high_20 = float(window_20["h"].max())
            low_20 = float(window_20["l"].min())
            rng = high_20 - low_20
            if rng > 0:
                aligned_close = float(window_20["c"].iloc[-1])
                clr = max(0.0, min(1.0, (aligned_close - low_20) / rng))
        row["close_location_in_range"] = clr

        # ── above_breakout_extension ─────────────────────────────────────────
        ext = float("nan")
        if len(ohlc) >= 51:
            prior_high_50 = float(ohlc["h"].iloc[-51:-1].max())
            if prior_high_50 > 0:
                aligned_close = float(ohlc["c"].iloc[-1])
                ext = max(0.0, (aligned_close / prior_high_50) - 1.0)
        row["above_breakout_extension"] = ext

        # ── 52-week high proximity ────────────────────────────────────────────
        dist_52w = float("nan")
        near_high = float("nan")
        if len(c) >= 252:
            rolling_max_252 = float(c.iloc[-252:].max())
            if rolling_max_252 > 0:
                dist_52w = (last_close - rolling_max_252) / rolling_max_252  # <= 0
                near_high = dist_52w >= -0.05
        row["dist_52w_high_pct"] = dist_52w
        row["near_52w_high"] = near_high

        # ── breakout_volume_confirmation + volume_ratio + avg_daily_volume_eur ─
        if v_raw is not None:
            cv = pd.concat({"c": c_raw, "v": v_raw}, axis=1).dropna()
            if len(cv) >= 21:
                today_vol = float(cv["v"].iloc[-1])
                avg_vol_20 = float(cv["v"].iloc[-21:-1].mean())
                row["breakout_volume_confirmation"] = bool(today_vol > 1.5 * avg_vol_20)
                if avg_vol_20 > 0:
                    row["volume_ratio"] = today_vol / avg_vol_20
                aligned_close = float(cv["c"].iloc[-1])
                quote_turnover = aligned_close * avg_vol_20
                quote_to_eur_rate = _quote_to_eur_rate(ticker, quote_to_eur_rates)
                if quote_to_eur_rate is not None:
                    row["avg_daily_volume_eur"] = quote_turnover * quote_to_eur_rate

            # ── buy_pressure_ratio: volume-weighted close-location over 20 bars ──
            # >0.5 = recent range accumulated (buy-dominated), <0.5 = distributed.
            if h_raw is not None and l_raw is not None:
                bpr = windowed_buy_pressure_ratio(h_raw, l_raw, c_raw, v_raw, n=20)
                if pd.notna(bpr):
                    row["buy_pressure_ratio"] = bpr

        rows.append(row)

    if not rows:
        return pd.DataFrame(
            columns=["consolidation_tightness", "close_location_in_range", "above_breakout_extension", "dist_52w_high_pct", "near_52w_high"],
            index=pd.Index([], name="ticker"),
        )

    result = pd.DataFrame(rows).set_index("ticker")
    return result.sort_index()
