from pathlib import Path
import argparse
import sys

from swing_screener.reporting.report import build_daily_report
from swing_screener.data.market_data import fetch_ohlcv
from swing_screener.data.universe import (
    load_universe_from_package,
    load_universe_from_file,
    UniverseConfig,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="swing-screener",
        description="Swing trading screener and backtesting framework",
    )
    sub = parser.add_subparsers(dest="command")

    run = sub.add_parser("run", help="Run daily screener")

    src = run.add_mutually_exclusive_group(required=True)
    src.add_argument("--tickers", nargs="+", help="Manual tickers list")
    src.add_argument("--universe", help="Universe name (e.g. mega, sp500)")
    src.add_argument("--universe-file", help="Path to a file containing tickers")

    run.add_argument(
        "--top", type=int, default=None, help="Optional cap on number of tickers loaded"
    )
    run.add_argument("--csv", help="Export CSV report (path)")

    args = parser.parse_args()

    if args.command != "run":
        parser.print_help()
        sys.exit(1)

    ucfg = UniverseConfig(benchmark="SPY", ensure_benchmark=True, max_tickers=args.top)

    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers]
        # enforce benchmark
        if "SPY" not in tickers:
            tickers.append("SPY")
    elif args.universe:
        tickers = load_universe_from_package(args.universe, ucfg)
    else:
        tickers = load_universe_from_file(args.universe_file, ucfg)

    ohlcv = fetch_ohlcv(tickers)
    report = build_daily_report(ohlcv)

    if report.empty:
        print("No candidates today.")
        return

    print(report.head(10))

    if args.csv:
        path = Path(args.csv)
        path.parent.mkdir(
            parents=True, exist_ok=True
        )  # fixes your previous 'out/' crash
        report.to_csv(path)
        print(f"Saved report to {path.resolve()}")
