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
    get_universe_meta,
    filter_ticker_list,
    apply_universe_config,
    validate_universe_snapshot,
)
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


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="swing-screener",
        description="Swing trading screener framework",
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
    # UNIVERSES (list/show/validate/doctor)
    # -------------------------
    uni = sub.add_parser("universes", help="Inspect and validate universes")
    uni_sub = uni.add_subparsers(dest="uni_command", required=True)

    uni_sub.add_parser("list", help="List packaged universes")

    uni_show = uni_sub.add_parser("show", help="Preview a universe")
    src_show = uni_show.add_mutually_exclusive_group(required=True)
    src_show.add_argument("--name", help="Packaged universe name (e.g. broad_market_stocks)")
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

    uni_sub.add_parser("validate", help="Validate all packaged universes against instrument master and rules")

    uni_doctor = uni_sub.add_parser("doctor", help="Detailed validation for a single universe")
    uni_doctor.add_argument("--name", required=True, help="Universe id to inspect")

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
        choices=["openai", "mock"],
        default="openai",
        help="LLM provider to use (default: openai)",
    )
    classify.add_argument(
        "--model",
        default="gpt-4.1-mini",
        help="Model name for provider (default: gpt-4.1-mini)",
    )
    classify.add_argument(
        "--base-url",
        default=None,
        help="Optional provider base URL override",
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
                meta = get_universe_meta(n)
                desc = meta.get("description", "") if meta else ""
                print(f"- {n}" + (f"  {desc}" if desc else ""))
            return

        if args.uni_command == "show":
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
            n = len(tickers)
            top_n = args.top if args.top is not None else n
            print(f"Tickers: {n} (showing first {min(top_n, n)})")
            for t in tickers[:top_n]:
                print(t)
            return

        if args.uni_command == "validate":
            names = list_package_universes()
            all_ok = True
            for uid in names:
                errors = validate_universe_snapshot(uid)
                if errors:
                    all_ok = False
                    print(f"FAIL {uid}:")
                    for e in errors:
                        print(f"     {e}")
                else:
                    print(f"OK   {uid}")
            if not all_ok:
                sys.exit(1)
            return

        if args.uni_command == "doctor":
            uid = args.name
            meta = get_universe_meta(uid)
            if meta is None:
                print(f"Unknown universe id: '{uid}'")
                sys.exit(1)
            print(f"Universe: {uid}")
            print(f"  Kind:           {meta.get('kind', '?')}")
            print(f"  Description:    {meta.get('description', '')}")
            print(f"  Benchmark:      {meta.get('benchmark', '?')}")
            print(f"  Source:         {meta.get('source', '?')} @ {meta.get('source_asof', '?')}")
            print(f"  Last reviewed:  {meta.get('last_reviewed_at', '?')}")
            print(f"  Stale after:    {meta.get('stale_after_days', '?')} days")
            errors = validate_universe_snapshot(uid)
            if errors:
                print(f"  Validation: FAIL ({len(errors)} issues)")
                for e in errors:
                    print(f"    {e}")
                sys.exit(1)
            else:
                print("  Validation: OK")
            return

        parser.error("Unknown universes command")
        sys.exit(1)

    parser.print_help()
    sys.exit(1)


if __name__ == "__main__":
    main()
