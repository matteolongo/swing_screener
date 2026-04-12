#!/usr/bin/env python3
"""Command-line interface for the Swing Screener.

Example usage:
    python -m agent.cli screen --universe mega_all --strategy-id default --top 10
    python -m agent.cli positions review
    python -m agent.cli positions suggest-stops
    python -m agent.cli positions update-stop <position_id> <new_stop>
    python -m agent.cli orders list --status pending
    python -m agent.cli daily-review
    python -m agent.cli chat "What orders are pending right now?"
"""
import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )


# ---------------------------------------------------------------------------
# Service factories (mirror api/dependencies.py without FastAPI Depends)
# ---------------------------------------------------------------------------

def _data_dir() -> Path:
    from swing_screener.settings import data_dir
    return data_dir()


def _portfolio_service():
    from api.repositories.positions_repo import PositionsRepository
    from api.services.portfolio_service import PortfolioService
    from api.utils.files import get_today_str, write_json_file
    path = _data_dir() / "positions.json"
    if not path.exists():
        write_json_file(path, {"asof": get_today_str(), "positions": []})
    return PortfolioService(positions_repo=PositionsRepository(path))


def _strategy_service():
    from api.repositories.strategy_repo import StrategyRepository
    from api.services.strategy_service import StrategyService
    return StrategyService(strategy_repo=StrategyRepository())


def _screener_service():
    from api.repositories.strategy_repo import StrategyRepository
    from api.services.screener_service import ScreenerService
    return ScreenerService(
        strategy_repo=StrategyRepository(),
        portfolio_service=_portfolio_service(),
    )


def _intelligence_config_service():
    from api.repositories.strategy_repo import StrategyRepository
    from api.repositories.intelligence_config_repo import IntelligenceConfigRepository
    from api.repositories.intelligence_symbol_sets_repo import IntelligenceSymbolSetsRepository
    from api.services.intelligence_config_service import IntelligenceConfigService
    return IntelligenceConfigService(
        strategy_repo=StrategyRepository(),
        config_repo=IntelligenceConfigRepository(),
        symbol_sets_repo=IntelligenceSymbolSetsRepository(),
    )


def _workspace_context_service():
    from api.repositories.strategy_repo import StrategyRepository
    from api.services.intelligence_service import IntelligenceService
    from api.services.workspace_context_service import WorkspaceContextService
    return WorkspaceContextService(
        portfolio_service=_portfolio_service(),
        strategy_service=_strategy_service(),
        intelligence_service=IntelligenceService(
            strategy_repo=StrategyRepository(),
            config_service=_intelligence_config_service(),
        ),
    )


def _chat_service():
    from api.services.chat_service import ChatService
    return ChatService(
        workspace_context_service=_workspace_context_service(),
        config_service=_intelligence_config_service(),
    )


def _daily_review_service():
    from api.services.daily_review_service import DailyReviewService
    return DailyReviewService(
        screener_service=_screener_service(),
        portfolio_service=_portfolio_service(),
        data_dir=_data_dir(),
    )


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------

def cmd_screen(args: argparse.Namespace) -> int:
    from api.models.screener import ScreenerRequest
    service = _screener_service()
    try:
        request = ScreenerRequest(
            universe=args.universe,
            strategy_id=args.strategy_id,
            top=args.top,
        )
        result = service.run_screener(request)
        candidates = result.candidates or []
        if candidates:
            print(f"\nTop Candidates ({len(candidates)}):")
            for i, c in enumerate(candidates, 1):
                print(f"\n{i}. {c.ticker}")
                print(f"   Entry: ${c.entry:.2f}  Stop: ${c.stop:.2f}")
                if c.momentum_6m is not None:
                    print(f"   Momentum 6m: {c.momentum_6m:.1%}")
        else:
            print("\nNo candidates returned.")
        if args.output:
            with open(args.output, "w") as f:
                json.dump(result.model_dump(mode="json"), f, indent=2)
            print(f"\nResults saved to {args.output}")
        return 0
    except Exception as e:
        logging.error(f"Screening failed: {e}", exc_info=True)
        return 1


def cmd_positions_review(args: argparse.Namespace) -> int:
    service = _portfolio_service()
    try:
        result = service.list_positions("open")
        positions = result.positions or []
        if positions:
            print(f"\nOpen Positions ({len(positions)}):")
            for p in positions:
                symbol = "+" if (p.unrealized_pnl or 0) >= 0 else "-"
                print(f"\n{symbol} {p.ticker}")
                print(f"   Entry: ${p.entry_price:.2f}  Stop: ${p.stop_price:.2f}")
                if p.r_multiple is not None:
                    print(f"   R: {p.r_multiple:.2f}R")
                if p.unrealized_pnl is not None:
                    print(f"   P&L: ${p.unrealized_pnl:.2f}")
        else:
            print("\nNo open positions.")
        return 0
    except Exception as e:
        logging.error(f"Position review failed: {e}", exc_info=True)
        return 1


def cmd_positions_suggest_stops(args: argparse.Namespace) -> int:
    service = _portfolio_service()
    try:
        result = service.list_positions("open")
        positions = result.positions or []
        suggestions = []
        for p in positions:
            try:
                suggestion = service.suggest_position_stop(p.position_id)
                if suggestion.should_update:
                    suggestions.append((p.ticker, p.stop_price, suggestion))
            except Exception:
                pass
        if suggestions:
            print(f"\nStop Price Suggestions ({len(suggestions)}):")
            for ticker, current_stop, s in suggestions:
                print(f"\n  {ticker}")
                print(f"   Current stop: ${current_stop:.2f}")
                print(f"   Suggested:    ${s.new_stop:.2f}")
                if s.reason:
                    print(f"   Reason: {s.reason}")
        else:
            print("\nNo stop updates recommended.")
        return 0
    except Exception as e:
        logging.error(f"Stop suggestion failed: {e}", exc_info=True)
        return 1


def cmd_positions_update_stop(args: argparse.Namespace) -> int:
    from api.models.portfolio import UpdateStopRequest
    service = _portfolio_service()
    try:
        service.update_position_stop(
            args.position_id,
            UpdateStopRequest(new_stop=args.new_stop),
        )
        print(f"\nStop updated for {args.position_id} -> ${args.new_stop:.2f}")
        return 0
    except Exception as e:
        logging.error(f"Stop update failed: {e}", exc_info=True)
        return 1


def cmd_orders_list(args: argparse.Namespace) -> int:
    service = _portfolio_service()
    try:
        result = service.list_degiro_orders()
        orders = result.orders or []
        print(f"\nOrders (status: {args.status or 'all'}):")
        filtered = [o for o in orders if args.status is None or o.status == args.status]
        if filtered:
            for o in filtered:
                symbol = {"pending": "~", "filled": "+", "cancelled": "x"}.get(o.status or "", "?")
                print(f"\n  {symbol} {o.ticker} — {o.order_kind or ''} {o.order_type or ''}")
                print(f"     ID: {o.order_id}  Status: {o.status}")
                if o.limit_price:
                    print(f"     Limit: ${o.limit_price:.2f}")
        else:
            print("  No orders found.")
        return 0
    except Exception as e:
        logging.error(f"Order listing failed: {e}", exc_info=True)
        return 1


def cmd_daily_review(args: argparse.Namespace) -> int:
    service = _daily_review_service()
    try:
        review = service.generate_daily_review(top_n=200)
        new = review.new_candidates or []
        hold = review.positions_hold or []
        update = review.positions_update_stop or []
        close = review.positions_close or []
        print(f"\nDaily Review")
        print(f"  New candidates:   {len(new)}")
        print(f"  Hold positions:   {len(hold)}")
        print(f"  Stop updates:     {len(update)}")
        print(f"  Close positions:  {len(close)}")
        if new:
            print(f"\nTop New Candidates:")
            for c in new[:5]:
                print(f"  {c.ticker}  entry=${c.entry:.2f}  stop=${c.stop:.2f}")
        if update:
            print(f"\nStop Updates:")
            for u in update:
                print(f"  {u.ticker}  new stop=${u.new_stop:.2f}")
        return 0
    except Exception as e:
        logging.error(f"Daily review failed: {e}", exc_info=True)
        return 1


def cmd_chat(args: argparse.Namespace) -> int:
    from api.models.chat import ChatAnswerRequest
    service = _chat_service()
    try:
        request = ChatAnswerRequest(
            question=args.question,
            selected_ticker=args.ticker,
        )
        result = service.answer(request)
        print("\n" + "=" * 60)
        print("WORKSPACE CHAT")
        print("=" * 60)
        print(result.answer)
        if result.warnings:
            print("\nWarnings:")
            for w in result.warnings:
                print(f"  - {w}")
        print("=" * 60 + "\n")
        return 0
    except Exception as e:
        logging.error(f"Chat failed: {e}", exc_info=True)
        return 1


# ---------------------------------------------------------------------------
# Argument parser + router
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Swing Screener CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    subparsers = parser.add_subparsers(dest="command")

    # screen
    screen_parser = subparsers.add_parser("screen", help="Run screening")
    screen_parser.add_argument("--universe", default="mega_all")
    screen_parser.add_argument("--strategy-id")
    screen_parser.add_argument("--top", type=int, default=10)
    screen_parser.add_argument("--output", help="Save results to JSON file")

    # positions
    positions_parser = subparsers.add_parser("positions", help="Position management")
    pos_sub = positions_parser.add_subparsers(dest="action")
    pos_sub.add_parser("review", help="Review open positions")
    pos_sub.add_parser("suggest-stops", help="Get stop price suggestions")
    update_stop = pos_sub.add_parser("update-stop", help="Update a stop price")
    update_stop.add_argument("position_id")
    update_stop.add_argument("new_stop", type=float)

    # orders
    orders_parser = subparsers.add_parser("orders", help="Order management")
    ord_sub = orders_parser.add_subparsers(dest="action")
    list_orders = ord_sub.add_parser("list", help="List orders")
    list_orders.add_argument("--status", choices=["pending", "filled", "cancelled"])

    # daily-review
    subparsers.add_parser("daily-review", help="Run daily review")

    # chat
    chat_parser = subparsers.add_parser("chat", help="Ask a workspace question")
    chat_parser.add_argument("question")
    chat_parser.add_argument("--ticker", help="Optional focused ticker")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return 1

    setup_logging(args.log_level)

    if args.command == "screen":
        return cmd_screen(args)
    elif args.command == "positions":
        if not args.action:
            positions_parser.print_help()
            return 1
        if args.action == "review":
            return cmd_positions_review(args)
        elif args.action == "suggest-stops":
            return cmd_positions_suggest_stops(args)
        elif args.action == "update-stop":
            return cmd_positions_update_stop(args)
    elif args.command == "orders":
        if not args.action:
            orders_parser.print_help()
            return 1
        if args.action == "list":
            return cmd_orders_list(args)
    elif args.command == "daily-review":
        return cmd_daily_review(args)
    elif args.command == "chat":
        return cmd_chat(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
