#!/usr/bin/env python3
"""Developer tool: compare OHLCV data between yfinance and Alpaca for a set of symbols.

Usage:
    python scripts/validate_ohlcv_alpaca.py [--symbols AAPL MSFT ...] [--lookback-days N] [--threshold-pct P]

Requires ALPACA_API_KEY and ALPACA_SECRET_KEY environment variables.
Exits 0 if all divergences are within the threshold, or if Alpaca credentials
are absent (skips the comparison cleanly).  Exits non-zero on divergence.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import date, timedelta


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate OHLCV parity between yfinance and Alpaca.")
    parser.add_argument(
        "--symbols",
        nargs="+",
        default=["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL"],
        metavar="SYMBOL",
        help="Symbols to validate (default: AAPL MSFT NVDA AMZN GOOGL)",
    )
    parser.add_argument(
        "--lookback-days",
        type=int,
        default=5,
        dest="lookback_days",
        help="Number of calendar days to look back (default: 5)",
    )
    parser.add_argument(
        "--threshold-pct",
        type=float,
        default=0.5,
        dest="threshold_pct",
        help="Max allowed close-price divergence in percent (default: 0.5)",
    )
    return parser.parse_args()


def _check_creds() -> tuple[str, str] | None:
    api_key = os.environ.get("ALPACA_API_KEY", "").strip()
    secret_key = os.environ.get("ALPACA_SECRET_KEY", "").strip()
    if not api_key or not secret_key:
        return None
    return api_key, secret_key


def _fetch_yfinance(symbols: list[str], start: date, end: date) -> dict[str, dict[str, float]]:
    """Return {symbol: {date_str: close}} from yfinance."""
    try:
        import yfinance as yf  # type: ignore[import]
    except ImportError:
        print("ERROR: yfinance is not installed.", file=sys.stderr)
        sys.exit(1)

    result: dict[str, dict[str, float]] = {}
    tickers = yf.download(
        symbols,
        start=start.isoformat(),
        end=(end + timedelta(days=1)).isoformat(),
        auto_adjust=True,
        progress=False,
        group_by="ticker",
    )
    for sym in symbols:
        try:
            if len(symbols) == 1:
                closes = tickers["Close"]
            else:
                closes = tickers[sym]["Close"]
            result[sym] = {str(idx.date()): float(val) for idx, val in closes.dropna().items()}
        except (KeyError, AttributeError):
            result[sym] = {}
    return result


def _fetch_alpaca(
    symbols: list[str],
    start: date,
    end: date,
    api_key: str,
    secret_key: str,
) -> dict[str, dict[str, float]]:
    """Return {symbol: {date_str: close}} from Alpaca historical bars."""
    try:
        from alpaca.data.historical import StockHistoricalDataClient  # type: ignore[import]
        from alpaca.data.requests import StockBarsRequest  # type: ignore[import]
        from alpaca.data.timeframe import TimeFrame  # type: ignore[import]
    except ImportError:
        print("ERROR: alpaca-py is not installed (pip install alpaca-py).", file=sys.stderr)
        sys.exit(1)

    client = StockHistoricalDataClient(api_key=api_key, secret_key=secret_key)
    request = StockBarsRequest(
        symbol_or_symbols=symbols,
        timeframe=TimeFrame.Day,
        start=start.isoformat(),
        end=(end + timedelta(days=1)).isoformat(),
        adjustment="all",
    )
    bars = client.get_stock_bars(request).df

    result: dict[str, dict[str, float]] = {sym: {} for sym in symbols}
    if bars.empty:
        return result

    # bars.df has a MultiIndex (symbol, timestamp) or single index depending on input
    import pandas as pd  # type: ignore[import]

    if isinstance(bars.index, pd.MultiIndex):
        for (sym, ts), row in bars.iterrows():
            day = str(ts.date()) if hasattr(ts, "date") else str(ts)[:10]
            result.setdefault(sym, {})[day] = float(row["close"])
    else:
        sym = symbols[0] if len(symbols) == 1 else None
        if sym:
            for ts, row in bars.iterrows():
                day = str(ts.date()) if hasattr(ts, "date") else str(ts)[:10]
                result[sym][day] = float(row["close"])
    return result


def _compare(
    yf_data: dict[str, dict[str, float]],
    alpaca_data: dict[str, dict[str, float]],
    threshold_pct: float,
) -> list[dict]:
    """Return list of divergence records."""
    rows: list[dict] = []
    for sym in sorted(yf_data):
        yf_days = yf_data[sym]
        alp_days = alpaca_data.get(sym, {})
        common_days = sorted(set(yf_days) & set(alp_days))
        for day in common_days:
            yf_close = yf_days[day]
            alp_close = alp_days[day]
            if yf_close == 0:
                continue
            pct_diff = abs(yf_close - alp_close) / yf_close * 100
            rows.append(
                {
                    "symbol": sym,
                    "date": day,
                    "yfinance": round(yf_close, 4),
                    "alpaca": round(alp_close, 4),
                    "pct_diff": round(pct_diff, 4),
                    "exceeded": pct_diff > threshold_pct,
                }
            )
    return rows


def _print_table(rows: list[dict], threshold_pct: float) -> None:
    header = f"{'Symbol':<8} {'Date':<12} {'yfinance':>10} {'Alpaca':>10} {'Diff%':>8} {'Status':<8}"
    print(header)
    print("-" * len(header))
    for row in rows:
        status = "FAIL" if row["exceeded"] else "ok"
        print(
            f"{row['symbol']:<8} {row['date']:<12} {row['yfinance']:>10.4f} "
            f"{row['alpaca']:>10.4f} {row['pct_diff']:>7.3f}% {status:<8}"
        )
    print()
    failures = [r for r in rows if r["exceeded"]]
    if failures:
        print(f"FAIL: {len(failures)} row(s) exceeded the {threshold_pct}% threshold.")
    else:
        print(f"PASS: all {len(rows)} compared rows are within {threshold_pct}%.")


def main() -> int:
    args = _parse_args()

    creds = _check_creds()
    if creds is None:
        print(
            "No Alpaca credentials found (ALPACA_API_KEY / ALPACA_SECRET_KEY not set). "
            "Skipping validation — exiting 0."
        )
        return 0

    api_key, secret_key = creds
    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=args.lookback_days)
    symbols: list[str] = [s.upper() for s in args.symbols]

    print(f"Validating {symbols} from {start} to {end} (threshold={args.threshold_pct}%)")
    print()

    yf_data = _fetch_yfinance(symbols, start, end)
    alpaca_data = _fetch_alpaca(symbols, start, end, api_key, secret_key)

    rows = _compare(yf_data, alpaca_data, args.threshold_pct)
    if not rows:
        print("No overlapping trading days found to compare.")
        return 0

    _print_table(rows, args.threshold_pct)
    return 1 if any(r["exceeded"] for r in rows) else 0


if __name__ == "__main__":
    sys.exit(main())
