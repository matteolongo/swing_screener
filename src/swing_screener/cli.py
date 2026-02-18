from __future__ import annotations

from pathlib import Path
from dataclasses import replace
import argparse
import sys
import datetime as dt

import pandas as pd

from swing_screener.reporting.report import build_daily_report
from swing_screener.reporting.concentration import sector_concentration_warnings
from swing_screener.risk.regime import compute_regime_risk_multiplier
from swing_screener.data.providers.factory import get_market_data_provider
from swing_screener.data.universe import (
    load_universe_from_package,
    load_universe_from_file,
    UniverseConfig,
    list_package_universes,
    get_universe_benchmark,
    get_universe_package_path,
    filter_ticker_list,
    apply_universe_config,
    save_universe_file,
)
from swing_screener.execution.order_workflows import fill_entry_order, scale_in_fill, normalize_orders
from swing_screener.execution.orders import Order, load_orders, save_orders
from swing_screener.portfolio.state import load_positions, save_positions
from swing_screener.strategy.config import build_manage_config, build_report_config, build_risk_config
from swing_screener.strategy.storage import get_active_strategy, get_strategy_by_id


def _dedup_keep_order(items: list[str]) -> list[str]:
    out: list[str] = []
    for x in items:
        x = x.strip().upper()
        if x and x not in out:
            out.append(x)
    return out


def _resolve_strategy(strategy_id: str | None) -> dict:
    if strategy_id:
        strategy = get_strategy_by_id(strategy_id)
        if strategy is None:
            raise ValueError(f"Strategy '{strategy_id}' not found.")
        return strategy
    return get_active_strategy()


def _resolve_tickers_from_run_args(args, *, benchmark: str) -> list[str]:
    ucfg = UniverseConfig(benchmark=benchmark, ensure_benchmark=True, max_tickers=args.top)

    if args.tickers:
        tickers = _dedup_keep_order([t for t in args.tickers])
        if benchmark not in tickers:
            tickers.append(benchmark)
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
    fee_eur: float | None = None,
    fill_fx_rate: float | None = None,
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
        fee_eur=fee_eur,
        fill_fx_rate=fill_fx_rate,
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
    fee_eur: float | None = None,
    fill_fx_rate: float | None = None,
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
        fee_eur=fee_eur,
        fill_fx_rate=fill_fx_rate,
    )
    save_orders(orders_path, new_orders, asof=str(dt.date.today()))
    save_positions(positions_path, new_positions, asof=str(dt.date.today()))


def _orders_list(
    orders_path: str,
    status: str | None,
    kind: str | None,
    ticker: str | None,
) -> list[Order]:
    orders = load_orders(orders_path)
    orders, _ = normalize_orders(orders)
    out = orders
    if status:
        out = [o for o in out if o.status == status]
    if kind:
        out = [o for o in out if o.order_kind == kind]
    if ticker:
        out = [o for o in out if o.ticker == ticker]
    return out


def _orders_cancel(
    orders_path: str,
    order_id: str,
) -> None:
    orders = load_orders(orders_path)
    orders, _ = normalize_orders(orders)
    found = False
    out: list[Order] = []
    for o in orders:
        if o.order_id != order_id:
            out.append(o)
            continue
        found = True
        if o.status != "pending":
            raise ValueError(f"{order_id}: only pending orders can be cancelled.")
        out.append(replace(o, status="cancelled"))
    if not found:
        raise ValueError(f"Order '{order_id}' not found.")
    save_orders(orders_path, out, asof=str(dt.date.today()))


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
    src.add_argument("--universe", help="Universe name (e.g. mega_all, sp500)")
    src.add_argument("--universe-file", help="Path to a file containing tickers")

    run.add_argument(
        "--top", type=int, default=None, help="Optional cap on number of tickers loaded"
    )
    run.add_argument("--csv", help="Export CSV report (path)")
    run.add_argument(
        "--positions",
        help="Path to positions.json (open positions are excluded from screening)",
    )
    run.add_argument(
        "--strategy-id",
        help="Strategy id to use (defaults to active)",
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
    manage.add_argument(
        "--strategy-id",
        help="Strategy id to use (defaults to active)",
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
    orders_fill.add_argument(
        "--fee-eur",
        type=float,
        default=None,
        help="Execution fee in EUR (optional, for DeGiro alignment)",
    )
    orders_fill.add_argument(
        "--fx-rate",
        type=float,
        default=None,
        help=(
            "Fill FX rate as quote currency units per 1 EUR "
            "(optional, e.g. 1 EUR = 1.18 USD for EUR/USD = 1.18)"
        ),
    )

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
    orders_scale.add_argument(
        "--fee-eur",
        type=float,
        default=None,
        help="Execution fee in EUR (optional, for DeGiro alignment)",
    )
    orders_scale.add_argument(
        "--fx-rate",
        type=float,
        default=None,
        help="Fill FX rate quote_ccy per EUR (optional, e.g. 1.18 for USD/EUR)",
    )

    orders_list = orders_sub.add_parser("list", help="List orders")
    orders_list.add_argument("--orders", required=True, help="Path to orders.json")
    orders_list.add_argument(
        "--status",
        choices=["pending", "filled", "cancelled"],
        default=None,
        help="Filter by status",
    )
    orders_list.add_argument(
        "--kind",
        choices=["entry", "stop", "take_profit"],
        default=None,
        help="Filter by order kind",
    )
    orders_list.add_argument("--ticker", default=None, help="Filter by ticker")

    orders_cancel = orders_sub.add_parser("cancel", help="Cancel a pending order")
    orders_cancel.add_argument("--orders", required=True, help="Path to orders.json")
    orders_cancel.add_argument("--order-id", required=True, help="Order ID to cancel")

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
    src_show.add_argument("--name", help="Packaged universe name (e.g. mega_all)")
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
    src_filter.add_argument("--name", help="Packaged universe name (e.g. mega_all)")
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

    # -------------------------
    # SOCIAL TEST (provider smoke test)
    # -------------------------
    social = sub.add_parser("social-test", help="Fetch social events for tickers")
    social.add_argument(
        "--symbols",
        nargs="+",
        required=True,
        help="Tickers to check for social mentions",
    )
    social.add_argument(
        "--hours",
        type=int,
        default=24,
        help="Lookback window in hours (default: 24)",
    )
    social.add_argument(
        "--subreddits",
        nargs="+",
        default=None,
        help="Optional override list of subreddits to scan",
    )

    # -------------------------
    # SOCIAL EXPORT (cache export)
    # -------------------------
    social_export = sub.add_parser("social-export", help="Export cached social data")
    social_export.add_argument(
        "--format",
        choices=["parquet", "csv"],
        default="parquet",
        help="Export format (default: parquet)",
    )
    social_export.add_argument(
        "--scope",
        choices=["events", "metrics", "both"],
        default="both",
        help="What to export (default: both)",
    )
    social_export.add_argument(
        "--out",
        default="out/social",
        help="Output directory (default: out/social)",
    )
    social_export.add_argument(
        "--provider",
        default="reddit",
        help="Provider folder to export (default: reddit)",
    )

    # -------------------------
    # CLASSIFY NEWS (LLM event classification)
    # -------------------------
    classify = sub.add_parser("classify-news", help="Classify financial news using LLM")
    classify.add_argument(
        "--symbols",
        nargs="+",
        required=True,
        help="Ticker symbols to fetch news for",
    )
    classify.add_argument(
        "--mock",
        action="store_true",
        help="Use mock news data (no real API calls)",
    )
    classify.add_argument(
        "--provider",
        choices=["ollama", "mock"],
        default="ollama",
        help="LLM provider to use (default: ollama)",
    )
    classify.add_argument(
        "--model",
        default="mistral:7b-instruct",
        help="Model name for provider (default: mistral:7b-instruct)",
    )
    classify.add_argument(
        "--base-url",
        default=None,
        help="Base URL for Ollama (default: http://localhost:11434)",
    )
    classify.add_argument(
        "--output",
        help="Optional output JSON file path",
    )

    args = parser.parse_args()

    # -------------------------
    # Dispatch
    # -------------------------
    if args.command == "run":
        try:
            strategy = _resolve_strategy(args.strategy_id)
        except ValueError as exc:
            print(str(exc))
            return

        report_cfg = build_report_config(strategy, top_override=args.top)
        benchmark = report_cfg.universe.mom.benchmark
        if args.universe:
            uni_benchmark = get_universe_benchmark(args.universe)
            if uni_benchmark and uni_benchmark != benchmark:
                report_cfg = replace(
                    report_cfg,
                    universe=replace(
                        report_cfg.universe,
                        mom=replace(report_cfg.universe.mom, benchmark=uni_benchmark),
                    ),
                )
                benchmark = uni_benchmark

        tickers = _resolve_tickers_from_run_args(args, benchmark=benchmark)

        # Fetch OHLCV data using provider
        provider = get_market_data_provider()
        # Use default date range: start from 2022-01-01 to today (matches MarketDataConfig defaults)
        end_date = dt.date.today().strftime("%Y-%m-%d")
        ohlcv = provider.fetch_ohlcv(tickers, start_date="2022-01-01", end_date=end_date)
        exclude_tickers = None
        if args.positions:
            from swing_screener.portfolio.state import load_positions

            positions = load_positions(args.positions)
            exclude_tickers = [
                p.ticker for p in positions if p.status == "open"
            ]

        multiplier, regime_meta = compute_regime_risk_multiplier(ohlcv, benchmark, report_cfg.risk)
        if multiplier != 1.0:
            report_cfg = replace(
                report_cfg,
                risk=replace(report_cfg.risk, risk_pct=report_cfg.risk.risk_pct * multiplier),
            )
            reasons = ", ".join(regime_meta.get("reasons", []))
            if reasons:
                print(f"Risk scaled by {multiplier:.2f}x due to regime: {reasons}")
            else:
                print(f"Risk scaled by {multiplier:.2f}x due to regime conditions.")

        report = build_daily_report(ohlcv, cfg=report_cfg, exclude_tickers=exclude_tickers)

        if report.empty:
            print("No candidates today.")
            return

        try:
            from swing_screener.data.ticker_info import get_multiple_ticker_info

            tickers = [str(t) for t in report.index]
            info = get_multiple_ticker_info(tickers)
            sector_map = {t: data.get("sector") for t, data in info.items()}
            for warning in sector_concentration_warnings(tickers, sector_map):
                print(f"Warning: {warning}")
        except Exception as exc:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("Sector concentration check failed: %s", exc, exc_info=True)
            print("(Sector concentration check unavailable - continuing without it)")

        print(report.head(10))

        if args.csv:
            path = Path(args.csv)
            path.parent.mkdir(parents=True, exist_ok=True)
            report.to_csv(path)
            print(f"Saved report to {path.resolve()}")
        return

    if args.command == "social-test":
        from swing_screener.social.providers.reddit import RedditProvider
        from swing_screener.social.cache import SocialCache
        from swing_screener.social.config import (
            DEFAULT_SUBREDDITS,
            DEFAULT_USER_AGENT,
            DEFAULT_RATE_LIMIT_PER_SEC,
        )

        symbols = _dedup_keep_order(args.symbols)
        if not symbols:
            print("No valid symbols provided.")
            return

        lookback_hours = max(1, int(args.hours))
        start = dt.datetime.utcnow() - dt.timedelta(hours=lookback_hours)
        end = dt.datetime.utcnow()
        subreddits = args.subreddits or list(DEFAULT_SUBREDDITS)

        provider = RedditProvider(
            list(subreddits),
            DEFAULT_USER_AGENT,
            DEFAULT_RATE_LIMIT_PER_SEC,
            SocialCache(),
        )

        try:
            events = provider.fetch_events(start, end, symbols)
        except (ConnectionError, TimeoutError) as exc:
            print(f"Social fetch failed (network error): {exc}")
            return
        except ValueError as exc:
            print(f"Social fetch failed (invalid data): {exc}")
            return
        except Exception as exc:
            import logging
            logger = logging.getLogger(__name__)
            logger.exception("Unexpected error fetching social events")
            print(f"Social fetch failed unexpectedly: {exc}")
            return

        counts: dict[str, int] = {}
        for ev in events:
            counts[ev.symbol] = counts.get(ev.symbol, 0) + 1

        print(f"Fetched {len(events)} events in last {lookback_hours}h")
        for sym in symbols:
            print(f"{sym}: {counts.get(sym, 0)} mentions")

        if events:
            sample = events[0]
            preview = sample.text.replace("\n", " ")[:120]
            print(f"Sample: {sample.symbol} @ {sample.timestamp} -> {preview}")
        return

    if args.command == "social-export":
        from swing_screener.social.cache import SocialCache
        from swing_screener.social.export import export_social_cache

        cache = SocialCache()
        out_dir = Path(args.out)
        saved = export_social_cache(
            cache,
            out_dir=out_dir,
            fmt=args.format,
            scope=args.scope,
            provider=args.provider,
        )

        if not saved:
            print("No cached social data found to export.")
            return

        for key, path in saved.items():
            print(f"Saved {key}: {path}")
        return

    if args.command == "classify-news":
        from swing_screener.intelligence.llm.cli import classify_news_command
        
        classify_news_command(
            symbols=args.symbols,
            mock=args.mock,
            provider=args.provider,
            model=args.model,
            base_url=args.base_url,
            output=args.output,
        )
        return

    if args.command == "manage":
        from swing_screener.portfolio.state import (
            load_positions,
            evaluate_positions,
            updates_to_dataframe,
            save_positions,
            apply_stop_updates,
            render_degiro_actions_md,
        )

        try:
            strategy = _resolve_strategy(args.strategy_id)
        except ValueError as exc:
            print(str(exc))
            return

        manage_cfg = build_manage_config(strategy)
        risk_cfg = build_risk_config(strategy)
        benchmark = manage_cfg.benchmark

        positions = load_positions(args.positions)

        open_tickers = [p.ticker for p in positions if p.status == "open"]
        if not open_tickers:
            print("No open positions found in positions.json")
            return

        total_open_risk = 0.0
        for pos in positions:
            if pos.status != "open":
                continue
            risk_per_share = pos.initial_risk
            if risk_per_share is None or risk_per_share <= 0:
                risk_per_share = pos.entry_price - pos.stop_price
            if risk_per_share > 0:
                total_open_risk += risk_per_share * pos.shares

        if risk_cfg.account_size > 0:
            pct = (total_open_risk / risk_cfg.account_size) * 100.0
            print(f"Open risk: {total_open_risk:.2f} ({pct:.2f}% of account)")
        else:
            print(f"Open risk: {total_open_risk:.2f}")

        tickers = _dedup_keep_order(open_tickers)

        # Ensure benchmark
        if benchmark not in tickers:
            tickers.append(benchmark)

        # Optional: widen download using a universe, but always keep open positions included
        if args.universe or args.universe_file:
            ucfg = UniverseConfig(
                benchmark=benchmark, ensure_benchmark=True, max_tickers=args.top
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
        provider = get_market_data_provider()
        # Use default date range: start from 2022-01-01 to today (matches MarketDataConfig defaults)
        end_date = dt.date.today().strftime("%Y-%m-%d")
        ohlcv = provider.fetch_ohlcv(tickers, start_date="2022-01-01", end_date=end_date)

        updates, new_positions = evaluate_positions(ohlcv, positions, manage_cfg)
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
                    fee_eur=float(args.fee_eur) if args.fee_eur is not None else None,
                    fill_fx_rate=float(args.fx_rate) if args.fx_rate is not None else None,
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
                    fee_eur=float(args.fee_eur) if args.fee_eur is not None else None,
                    fill_fx_rate=float(args.fx_rate) if args.fx_rate is not None else None,
                )
                print(f"Scale-in filled: {args.order_id}")
            elif args.orders_command == "list":
                rows = _orders_list(
                    orders_path=args.orders,
                    status=args.status,
                    kind=args.kind,
                    ticker=args.ticker,
                )
                if not rows:
                    print("No orders found.")
                    return
                cols = [
                    "order_id",
                    "ticker",
                    "status",
                    "order_kind",
                    "order_type",
                    "quantity",
                    "limit_price",
                    "stop_price",
                    "order_date",
                    "filled_date",
                ]
                df = pd.DataFrame([{c: getattr(o, c) for c in cols} for o in rows])
                print(df.to_string(index=False))
            elif args.orders_command == "cancel":
                _orders_cancel(
                    orders_path=args.orders,
                    order_id=args.order_id,
                )
                print(f"Order cancelled: {args.order_id}")
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
        return

    if args.command == "universes":
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
                    p = get_universe_package_path(n)
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
