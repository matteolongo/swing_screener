from __future__ import annotations

import argparse
import sys

from swing_screener.reporting.report import build_daily_report
from swing_screener.data.market_data import fetch_ohlcv


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="swing-screener",
        description="Swing trading screener and backtesting framework",
    )

    sub = parser.add_subparsers(dest="command")

    run = sub.add_parser("run", help="Run daily screener")
    run.add_argument("--tickers", nargs="+", required=True)
    run.add_argument("--csv", help="Export CSV report")

    args = parser.parse_args()

    if args.command == "run":
        tickers = [t.strip().upper() for t in args.tickers]
        tickers = [t for i, t in enumerate(tickers) if t and t not in tickers[:i]]

        # Always include benchmark for RS calculations
        benchmark = "SPY"
        if benchmark not in tickers:
            tickers = tickers + [benchmark]

        ohlcv = fetch_ohlcv(tickers)
        report = build_daily_report(ohlcv)

        if report.empty:
            print("No candidates today.")
            return

        print(report.head(10))

        if args.csv:
            report.to_csv(args.csv)
            print(f"Saved report to {args.csv}")


    else:
        parser.print_help()
        sys.exit(1)
