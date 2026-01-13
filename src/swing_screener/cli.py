from __future__ import annotations

from pathlib import Path
import argparse
import sys

import pandas as pd

from swing_screener.reporting.report import build_daily_report
from swing_screener.data.market_data import fetch_ohlcv
from swing_screener.data.universe import (
    load_universe_from_package,
    load_universe_from_file,
    UniverseConfig,
)


def _dedup_keep_order(items: list[str]) -> list[str]:
    out: list[str] = []
    for x in items:
        x = x.strip().upper()
        if x and x not in out:
            out.append(x)
    return out


def _resolve_tickers_from_run_args(args) -> list[str]:
    ucfg = UniverseConfig(benchmark="SPY", ensure_benchmark=True, max_tickers=args.top)

    if args.tickers:
        tickers = _dedup_keep_order([t for t in args.tickers])
        if "SPY" not in tickers:
            tickers.append("SPY")
        return tickers

    if args.universe:
        return load_universe_from_package(args.universe, ucfg)

    return load_universe_from_file(args.universe_file, ucfg)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="swing-screener",
        description="Swing trading screener and backtesting framework",
    )
    sub = parser.add_subparsers(dest="command")

    # -------------------------
    # RUN (daily screener)
    # -------------------------
    run = sub.add_parser("run", help="Run daily screener")
    src = run.add_mutually_exclusive_group(required=True)
    src.add_argument("--tickers", nargs="+", help="Manual tickers list")
    src.add_argument("--universe", help="Universe name (e.g. mega, sp500)")
    src.add_argument("--universe-file", help="Path to a file containing tickers")

    run.add_argument(
        "--top", type=int, default=None, help="Optional cap on number of tickers loaded"
    )
    run.add_argument("--csv", help="Export CSV report (path)")

    # -------------------------
    # MANAGE (open positions)
    # -------------------------
    manage = sub.add_parser(
        "manage",
        help="Manage existing positions (suggest stop updates / exits)",
    )
    manage.add_argument(
        "--positions",
        required=True,
        help="Path to positions.json (your saved trade state)",
    )
    manage.add_argument(
        "--universe",
        help="Universe name to fetch data for (optional). If set, open positions are always included.",
    )
    manage.add_argument(
        "--universe-file",
        help="Universe file to fetch data for (optional). If set, open positions are always included.",
    )
    manage.add_argument(
        "--top",
        type=int,
        default=None,
        help="Optional cap on number of tickers loaded (only used with --universe/--universe-file).",
    )
    manage.add_argument(
        "--apply",
        action="store_true",
        help="Apply suggested stop updates (MOVE_STOP_UP) directly into positions.json",
    )
    manage.add_argument("--csv", help="Export management report CSV (path)")
    manage.add_argument(
        "--md",
        help="Export a Degiro-friendly actions checklist in Markdown (path)",
    )

    args = parser.parse_args()

    # -------------------------
    # Dispatch
    # -------------------------
    if args.command == "run":
        tickers = _resolve_tickers_from_run_args(args)

        ohlcv = fetch_ohlcv(tickers)
        report = build_daily_report(ohlcv)

        if report.empty:
            print("No candidates today.")
            return

        print(report.head(10))

        if args.csv:
            path = Path(args.csv)
            path.parent.mkdir(parents=True, exist_ok=True)
            report.to_csv(path)
            print(f"Saved report to {path.resolve()}")
        return

    if args.command == "manage":
        from swing_screener.portfolio.state import (
            load_positions,
            evaluate_positions,
            updates_to_dataframe,
            ManageConfig,
            save_positions,
            apply_stop_updates,
            render_degiro_actions_md,
        )

        positions = load_positions(args.positions)

        open_tickers = [p.ticker for p in positions if p.status == "open"]
        if not open_tickers:
            print("No open positions found in positions.json")
            return

        tickers = _dedup_keep_order(open_tickers)

        # Ensure benchmark
        if "SPY" not in tickers:
            tickers.append("SPY")

        # Optional: widen download using a universe, but always keep open positions included
        if args.universe or args.universe_file:
            ucfg = UniverseConfig(
                benchmark="SPY", ensure_benchmark=True, max_tickers=args.top
            )
            if args.universe:
                tickers = load_universe_from_package(args.universe, ucfg)
            else:
                tickers = load_universe_from_file(args.universe_file, ucfg)

            # ensure open positions included
            for t in open_tickers:
                t = t.strip().upper()
                if t and t not in tickers:
                    tickers.append(t)

        # Fetch enough history for SMA trailing etc.
        ohlcv = fetch_ohlcv(tickers)

        updates, new_positions = evaluate_positions(ohlcv, positions, ManageConfig())
        df = updates_to_dataframe(updates)

        # Pretty display: format r_now as "x.xxR"
        df_disp = df.copy()
        if "r_now" in df_disp.columns:
            df_disp["r_now"] = df_disp["r_now"].map(lambda x: f"{float(x):.2f}R")

        print("\nPOSITION MANAGEMENT (suggestions):")
        cols = [
            "action",
            "last",
            "entry",
            "stop_old",
            "stop_suggested",
            "r_now",
            "reason",
        ]
        present = [c for c in cols if c in df_disp.columns]
        print(df_disp[present].to_string())

        # Apply stop updates to local state if requested
        if args.apply:
            before = {
                p.ticker: p.stop_price for p in new_positions if p.status == "open"
            }
            new_positions = apply_stop_updates(new_positions, updates)
            after = {
                p.ticker: p.stop_price for p in new_positions if p.status == "open"
            }

            changed = [
                t for t in before if (t in after) and (after[t] > before[t] + 1e-9)
            ]

            if changed:
                print(
                    f"\nApplied MOVE_STOP_UP stops into positions.json for: {', '.join(changed)}"
                )
            else:
                print("\n--apply set, but no MOVE_STOP_UP updates to apply today.")
        else:
            print(
                "\nNOTE: stops were NOT applied to positions.json. Use --apply to sync local state."
            )

        # Persist updated metadata (and stop_price if --apply)
        save_positions(
            args.positions, new_positions, asof=str(pd.Timestamp.now().date())
        )

        # Export CSV (raw numeric for later processing)
        if args.csv:
            path = Path(args.csv)
            path.parent.mkdir(parents=True, exist_ok=True)
            df.to_csv(path)
            print(f"\nSaved management report to {path.resolve()}")

        # Export Markdown actions checklist (Degiro friendly)
        if args.md:
            path = Path(args.md)
            path.parent.mkdir(parents=True, exist_ok=True)
            md_text = render_degiro_actions_md(updates)
            path.write_text(md_text, encoding="utf-8")
            print(f"\nSaved Degiro actions checklist to {path.resolve()}")

        return

    parser.print_help()
    sys.exit(1)
