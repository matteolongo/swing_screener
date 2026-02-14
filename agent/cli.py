#!/usr/bin/env python3
"""Command-line interface for the Swing Screener Agent.

This CLI allows you to interact with the agent for common workflows:
- Run daily screening
- Review positions
- Manage orders
- Update stops

Example usage:
    # Run daily screening
    python -m agent.cli screen --universe mega_all --top 10
    
    # Review positions
    python -m agent.cli positions review
    
    # List orders
    python -m agent.cli orders list --status pending
    
    # Get stop suggestions
    python -m agent.cli positions suggest-stops
"""
import asyncio
import argparse
import json
import logging
import sys
from typing import Optional

from agent.agent import SwingScreenerAgent


def setup_logging(level: str = "INFO") -> None:
    """Setup logging configuration.
    
    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR)
    """
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )


async def cmd_screen(args: argparse.Namespace) -> int:
    """Run screening workflow."""
    agent = SwingScreenerAgent()
    
    try:
        await agent.start()
        
        result = await agent.daily_screening(
            universe=args.universe,
            strategy=args.strategy,
            top_n=args.top
        )
        
        # Print candidates
        if result["candidates"]:
            print("\n📊 Top Candidates:")
            for i, candidate in enumerate(result["candidates"], 1):
                print(f"\n{i}. {candidate.get('ticker', 'Unknown')}")
                print(f"   Entry: ${candidate.get('entry_price', 0):.2f}")
                print(f"   Stop:  ${candidate.get('stop_price', 0):.2f}")
                if "momentum_6m" in candidate:
                    print(f"   Momentum: {candidate['momentum_6m']:.1%}")
                if "rank_score" in candidate:
                    print(f"   Rank Score: {candidate['rank_score']:.2f}")
        
        # Save to file if requested
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2)
            print(f"\n✅ Results saved to {args.output}")
        
        await agent.stop()
        return 0
        
    except Exception as e:
        logging.error(f"Screening failed: {e}", exc_info=True)
        await agent.stop()
        return 1


async def cmd_positions_review(args: argparse.Namespace) -> int:
    """Review open positions."""
    agent = SwingScreenerAgent()
    
    try:
        await agent.start()
        
        result = await agent.review_positions()
        
        # Print positions
        if result["positions"]:
            print("\n📈 Open Positions:")
            for pos in result["positions"]:
                ticker = pos.get("ticker", "Unknown")
                entry = pos.get("entry_price", 0)
                current = pos.get("current_price", 0)
                pnl = pos.get("unrealized_pnl", 0)
                r_mult = pos.get("r_multiple", 0)
                
                pnl_symbol = "📈" if pnl >= 0 else "📉"
                print(f"\n{pnl_symbol} {ticker}")
                print(f"   Entry: ${entry:.2f} → Current: ${current:.2f}")
                print(f"   P&L: ${pnl:.2f} ({r_mult:.2f}R)")
        
        await agent.stop()
        return 0
        
    except Exception as e:
        logging.error(f"Position review failed: {e}", exc_info=True)
        await agent.stop()
        return 1


async def cmd_positions_suggest_stops(args: argparse.Namespace) -> int:
    """Get stop price suggestions."""
    agent = SwingScreenerAgent()
    
    try:
        await agent.start()
        
        result = await agent.suggest_stop_updates()
        
        # Print suggestions
        if result["suggestions"]:
            print("\n🎯 Stop Price Suggestions:")
            for suggestion in result["suggestions"]:
                ticker = suggestion.get("ticker", "Unknown")
                current_stop = suggestion.get("current_stop", 0)
                suggested_stop = suggestion.get("suggested_stop", 0)
                should_update = suggestion.get("should_update", False)
                
                if should_update:
                    print(f"\n⚠️  {ticker}")
                    print(f"   Current stop: ${current_stop:.2f}")
                    print(f"   Suggested:    ${suggested_stop:.2f}")
                    print(f"   Reason: {suggestion.get('reason', 'N/A')}")
        else:
            print("\n✅ No stop updates recommended at this time")
        
        await agent.stop()
        return 0
        
    except Exception as e:
        logging.error(f"Stop suggestion failed: {e}", exc_info=True)
        await agent.stop()
        return 1


async def cmd_positions_update_stop(args: argparse.Namespace) -> int:
    """Update position stop price."""
    agent = SwingScreenerAgent()
    
    try:
        await agent.start()
        
        result = await agent.update_position_stop(
            position_id=args.position_id,
            new_stop_price=args.stop_price
        )
        
        print(f"\n✅ Stop updated for position {args.position_id}")
        
        await agent.stop()
        return 0
        
    except Exception as e:
        logging.error(f"Stop update failed: {e}", exc_info=True)
        await agent.stop()
        return 1


async def cmd_orders_list(args: argparse.Namespace) -> int:
    """List orders."""
    agent = SwingScreenerAgent()
    
    try:
        await agent.start()
        
        result = await agent.list_orders(status=args.status)
        
        # Print orders
        if result["orders"]:
            print(f"\n📋 Orders (status: {args.status or 'all'}):")
            for order in result["orders"]:
                order_id = order.get("order_id", "Unknown")
                ticker = order.get("ticker", "Unknown")
                order_type = order.get("order_type", "Unknown")
                kind = order.get("order_kind", "Unknown")
                status = order.get("status", "Unknown")
                
                status_symbol = {
                    "pending": "⏳",
                    "filled": "✅",
                    "cancelled": "❌"
                }.get(status, "❓")
                
                print(f"\n{status_symbol} {ticker} - {kind.upper()} {order_type}")
                print(f"   ID: {order_id}")
                print(f"   Status: {status}")
                
                if "limit_price" in order:
                    print(f"   Limit: ${order['limit_price']:.2f}")
        
        await agent.stop()
        return 0
        
    except Exception as e:
        logging.error(f"Order listing failed: {e}", exc_info=True)
        await agent.stop()
        return 1


async def cmd_orders_fill(args: argparse.Namespace) -> int:
    """Fill an order."""
    agent = SwingScreenerAgent()
    
    try:
        await agent.start()
        
        result = await agent.fill_order(
            order_id=args.order_id,
            fill_price=args.fill_price,
            fill_date=args.fill_date
        )
        
        print(f"\n✅ Order {args.order_id} filled at ${args.fill_price}")
        
        if result.get("result", {}).get("position_created"):
            print(f"   Position created: {result['result'].get('position_id')}")
        
        await agent.stop()
        return 0
        
    except Exception as e:
        logging.error(f"Order fill failed: {e}", exc_info=True)
        await agent.stop()
        return 1


async def cmd_daily_review(args: argparse.Namespace) -> int:
    """Run comprehensive daily review."""
    agent = SwingScreenerAgent()
    
    try:
        await agent.start()
        
        result = await agent.daily_review()
        
        # Output is printed by the agent
        
        await agent.stop()
        return 0
        
    except Exception as e:
        logging.error(f"Daily review failed: {e}", exc_info=True)
        await agent.stop()
        return 1


async def cmd_tools_list(args: argparse.Namespace) -> int:
    """List available MCP tools."""
    agent = SwingScreenerAgent()
    
    try:
        await agent.start()
        
        tools = agent.get_available_tools()
        
        print(f"\n🔧 Available MCP Tools ({len(tools)}):")
        for tool in sorted(tools):
            info = agent.client.get_tool_info(tool)
            desc = info.get("description", "No description") if info else "No description"
            print(f"\n  • {tool}")
            print(f"    {desc}")
        
        await agent.stop()
        return 0
        
    except Exception as e:
        logging.error(f"Tool listing failed: {e}", exc_info=True)
        await agent.stop()
        return 1


def main() -> int:
    """Main entry point for the CLI."""
    parser = argparse.ArgumentParser(
        description="Swing Screener Agent - AI-driven trading workflow automation",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Screen command
    screen_parser = subparsers.add_parser("screen", help="Run screening workflow")
    screen_parser.add_argument("--universe", default="mega_all", help="Stock universe")
    screen_parser.add_argument("--strategy", help="Strategy to use (default: active)")
    screen_parser.add_argument("--top", type=int, default=10, help="Number of top candidates")
    screen_parser.add_argument("--output", help="Save results to JSON file")
    
    # Positions commands
    positions_parser = subparsers.add_parser("positions", help="Position management")
    pos_subparsers = positions_parser.add_subparsers(dest="action", help="Position action")
    
    pos_subparsers.add_parser("review", help="Review open positions")
    pos_subparsers.add_parser("suggest-stops", help="Get stop price suggestions")
    
    update_stop_parser = pos_subparsers.add_parser("update-stop", help="Update position stop")
    update_stop_parser.add_argument("position_id", help="Position ID")
    update_stop_parser.add_argument("stop_price", type=float, help="New stop price")
    
    # Orders commands
    orders_parser = subparsers.add_parser("orders", help="Order management")
    ord_subparsers = orders_parser.add_subparsers(dest="action", help="Order action")
    
    list_orders_parser = ord_subparsers.add_parser("list", help="List orders")
    list_orders_parser.add_argument(
        "--status",
        choices=["pending", "filled", "cancelled"],
        help="Filter by status"
    )
    
    fill_order_parser = ord_subparsers.add_parser("fill", help="Fill an order")
    fill_order_parser.add_argument("order_id", help="Order ID")
    fill_order_parser.add_argument("fill_price", type=float, help="Fill price")
    fill_order_parser.add_argument("--fill-date", help="Fill date (YYYY-MM-DD)")
    
    # Daily review command
    subparsers.add_parser("daily-review", help="Run comprehensive daily review")
    
    # Tools command
    subparsers.add_parser("tools", help="List available MCP tools")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    setup_logging(args.log_level)
    
    # Route to command handlers
    if args.command == "screen":
        return asyncio.run(cmd_screen(args))
    elif args.command == "positions":
        if not args.action:
            positions_parser.print_help()
            return 1
        if args.action == "review":
            return asyncio.run(cmd_positions_review(args))
        elif args.action == "suggest-stops":
            return asyncio.run(cmd_positions_suggest_stops(args))
        elif args.action == "update-stop":
            return asyncio.run(cmd_positions_update_stop(args))
    elif args.command == "orders":
        if not args.action:
            orders_parser.print_help()
            return 1
        if args.action == "list":
            return asyncio.run(cmd_orders_list(args))
        elif args.action == "fill":
            return asyncio.run(cmd_orders_fill(args))
    elif args.command == "daily-review":
        return asyncio.run(cmd_daily_review(args))
    elif args.command == "tools":
        return asyncio.run(cmd_tools_list(args))
    
    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
