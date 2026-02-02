from __future__ import annotations

from pathlib import Path
import argparse
import sys
import datetime as dt

import pandas as pd

from swing_screener.reporting.report import build_daily_report
from swing_screener.data.market_data import fetch_ohlcv
from swing_screener.data.universe import (
    load_universe_from_package,
    load_universe_from_file,
    UniverseConfig,
    list_package_universes,
    filter_ticker_list,
    apply_universe_config,
    save_universe_file,
)
from swing_screener.execution.order_workflows import fill_entry_order, scale_in_fill
from swing_screener.execution.orders import load_orders, save_orders
from swing_screener.portfolio.state import load_positions, save_positions


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


def _orders_fill_to_files(
    orders_path: str,
    positions_path: str,
    order_id: str,
    fill_price: float,
    fill_date: str,
    quantity: int,
    stop_price: float,
    tp_price: float | None,
) -> None:
    orders = load_orders(orders_path)
    positions = load_positions(positions_path)
    new_orders, new_positions = fill_entry_order(
        orders,
        positions,
        order_id=order_id,
        fill_price=fill_price,
        fill_date=fill_date,
        quantity=quantity,
        stop_price=stop_price,
        tp_price=tp_price,
    )
    save_orders(orders_path, new_orders, asof=str(dt.date.today()))
    save_positions(positions_path, new_positions, asof=str(dt.date.today()))


def _orders_scale_in_to_files(
    orders_path: str,
    positions_path: str,
    order_id: str,
    fill_price: float,
    fill_date: str,
    quantity: int,
) -> None:
    orders = load_orders(orders_path)
    positions = load_positions(positions_path)
    new_orders, new_positions = scale_in_fill(
        orders,
        positions,
        order_id=order_id,
        fill_price=fill_price,
        fill_date=fill_date,
        quantity=quantity,
    )
    save_orders(orders_path, new_orders, asof=str(dt.date.today()))
    save_positions(positions_path, new_positions, asof=str(dt.date.today()))


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
    run.add_argument(
        "--positions",
        help="Path to positions.json (open positions are excluded from screening)",
    )

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

    # -------------------------
    # MIGRATE (orders <-> positions)
    # -------------------------
    migrate = sub.add_parser(
        "migrate",
        help="Backfill order/position links and optional stop orders",
    )
    migrate.add_argument(
        "--orders",
        required=True,
        help="Path to orders.json",
    )
    migrate.add_argument(
        "--positions",
        required=True,
        help="Path to positions.json",
    )
    migrate.add_argument(
        "--create-stop-orders",
        action="store_true",
        help="Create missing pending stop orders linked to open positions",
    )

    # -------------------------
    # ORDERS (fill / scale-in)
    # -------------------------
    orders_cmd = sub.add_parser("orders", help="Update orders and positions from fills")
    orders_sub = orders_cmd.add_subparsers(dest="orders_command", required=True)

    orders_fill = orders_sub.add_parser("fill", help="Mark entry order filled")
    orders_fill.add_argument("--orders", required=True, help="Path to orders.json")
    orders_fill.add_argument("--positions", required=True, help="Path to positions.json")
    orders_fill.add_argument("--order-id", required=True, help="Entry order ID to fill")
    orders_fill.add_argument("--fill-price", type=float, required=True, help="Fill price")
    orders_fill.add_argument(
        "--fill-date",
        default=str(dt.date.today()),
        help="Fill date (YYYY-MM-DD). Default: today.",
    )
    orders_fill.add_argument("--quantity", type=int, required=True, help="Filled quantity")
    orders_fill.add_argument("--stop-price", type=float, required=True, help="Stop-loss price")
    orders_fill.add_argument("--tp-price", type=float, default=None, help="Take-profit price (optional)")

    orders_scale = orders_sub.add_parser("scale-in", help="Scale into an existing position")
    orders_scale.add_argument("--orders", required=True, help="Path to orders.json")
    orders_scale.add_argument("--positions", required=True, help="Path to positions.json")
    orders_scale.add_argument("--order-id", required=True, help="Entry order ID to fill")
    orders_scale.add_argument("--fill-price", type=float, required=True, help="Fill price")
    orders_scale.add_argument(
        "--fill-date",
        default=str(dt.date.today()),
        help="Fill date (YYYY-MM-DD). Default: today.",
    )
    orders_scale.add_argument("--quantity", type=int, required=True, help="Filled quantity")

    # -------------------------
    # UNIVERSES (list/show/filter)
    # -------------------------
    uni = sub.add_parser("universes", help="Inspect and build universes")
    uni_sub = uni.add_subparsers(dest="uni_command", required=True)

    uni_list = uni_sub.add_parser("list", help="List packaged universes")
    uni_list.add_argument(
        "--show-paths",
        action="store_true",
        help="Show underlying CSV paths",
    )

    uni_show = uni_sub.add_parser("show", help="Preview a universe")
    src_show = uni_show.add_mutually_exclusive_group(required=True)
    src_show.add_argument("--name", help="Packaged universe name (e.g. mega)")
    src_show.add_argument("--file", help="Path to a universe file")
    uni_show.add_argument("--top", type=int, default=20, help="Preview the first N tickers")
    uni_show.add_argument("--grep", help="Keep tickers containing this substring (case-insensitive)")
    uni_show.add_argument("--include", nargs="+", help="Extra tickers to include")
    uni_show.add_argument("--exclude", nargs="+", help="Tickers to exclude")
    uni_show.add_argument("--benchmark", default="SPY", help="Benchmark to ensure (default: SPY)")
    uni_show.add_argument(
        "--no-benchmark",
        action="store_true",
        help="Do not auto-ensure benchmark ticker",
    )
    uni_show.add_argument(
        "--max",
        dest="max_tickers",
        type=int,
        default=None,
        help="Optional cap on tickers after filtering",
    )

    uni_filter = uni_sub.add_parser("filter", help="Filter a universe and save to CSV")
    src_filter = uni_filter.add_mutually_exclusive_group(required=True)
    src_filter.add_argument("--name", help="Packaged universe name (e.g. mega)")
    src_filter.add_argument("--file", help="Path to a universe file")
    uni_filter.add_argument(
        "--grep", help="Keep tickers containing this substring (case-insensitive)"
    )
    uni_filter.add_argument("--include", nargs="+", help="Extra tickers to include")
    uni_filter.add_argument("--exclude", nargs="+", help="Tickers to exclude")
    uni_filter.add_argument(
        "--benchmark", default="SPY", help="Benchmark to ensure (default: SPY)"
    )
    uni_filter.add_argument(
        "--no-benchmark",
        action="store_true",
        help="Do not auto-ensure benchmark ticker",
    )
    uni_filter.add_argument(
        "--max",
        dest="max_tickers",
        type=int,
        default=None,
        help="Optional cap on tickers after filtering",
    )
    uni_filter.add_argument(
        "--out",
        required=True,
        help="Path to save the filtered universe CSV",
    )

    args = parser.parse_args()

    # -------------------------
    # Dispatch
    # -------------------------
    if args.command == "run":
        tickers = _resolve_tickers_from_run_args(args)

        ohlcv = fetch_ohlcv(tickers)
        exclude_tickers = None
        if args.positions:
            from swing_screener.portfolio.state import load_positions

            positions = load_positions(args.positions)
            exclude_tickers = [
                p.ticker for p in positions if p.status == "open"
            ]

        report = build_daily_report(ohlcv, exclude_tickers=exclude_tickers)

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

    if args.command == "migrate":
        from swing_screener.portfolio.migrate import migrate_orders_positions

        _, _, updated = migrate_orders_positions(
            args.orders,
            args.positions,
            create_stop_orders=args.create_stop_orders,
        )

        if updated:
            print("Migration complete: orders.json and positions.json updated.")
        else:
            print("No migration changes needed.")
        return

    if args.command == "orders":
        try:
            if args.orders_command == "fill":
                _orders_fill_to_files(
                    orders_path=args.orders,
                    positions_path=args.positions,
                    order_id=args.order_id,
                    fill_price=float(args.fill_price),
                    fill_date=str(args.fill_date),
                    quantity=int(args.quantity),
                    stop_price=float(args.stop_price),
                    tp_price=float(args.tp_price) if args.tp_price is not None else None,
                )
                print(f"Order filled: {args.order_id}")
            elif args.orders_command == "scale-in":
                _orders_scale_in_to_files(
                    orders_path=args.orders,
                    positions_path=args.positions,
                    order_id=args.order_id,
                    fill_price=float(args.fill_price),
                    fill_date=str(args.fill_date),
                    quantity=int(args.quantity),
                )
                print(f"Scale-in filled: {args.order_id}")
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
        return

    if args.command == "universes":
        import importlib.resources as importlib_resources

        def _load_base(name: str | None, file: str | None) -> list[str]:
            cfg = UniverseConfig(
                benchmark=args.benchmark if hasattr(args, "benchmark") else "SPY",
                ensure_benchmark=False,
                max_tickers=None,
            )
            if name:
                return load_universe_from_package(name, cfg)
            return load_universe_from_file(file, cfg)

        if args.uni_command == "list":
            names = list_package_universes()
            if not names:
                print("No packaged universes found.")
                return
            print("Packaged universes:")
            for n in names:
                if args.show_paths:
                    pkg = "swing_screener.data"
                    p = (
                        importlib_resources.files(pkg)
                        .joinpath(f"universes/{n}.csv")
                        .resolve()
                    )
                    print(f"- {n} ({p})")
                else:
                    print(f"- {n}")
            return

        if args.uni_command in ("show", "filter"):
            base = _load_base(getattr(args, "name", None), getattr(args, "file", None))
            filtered = filter_ticker_list(
                base,
                include=args.include,
                exclude=args.exclude,
                grep=args.grep,
            )

            cfg = UniverseConfig(
                benchmark=args.benchmark,
                ensure_benchmark=not args.no_benchmark,
                max_tickers=args.max_tickers,
            )
            tickers = apply_universe_config(filtered, cfg)

            if args.uni_command == "show":
                n = len(tickers)
                top_n = args.top if args.top is not None else n
                print(f"Tickers: {n} (showing first {min(top_n, n)})")
                for t in tickers[:top_n]:
                    print(t)
                return

            if args.uni_command == "filter":
                path = save_universe_file(tickers, Path(args.out))
                print(f"Saved {len(tickers)} tickers to {path.resolve()}")
                return

        parser.error("Unknown universes command")
        sys.exit(1)

    parser.print_help()
    sys.exit(1)


if __name__ == "__main__":
    main()
