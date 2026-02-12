"""Example: Position management workflow.

This example demonstrates how to use the agent for managing
open positions, including reviewing positions and updating stops.
"""
import asyncio
from agent import SwingScreenerAgent


async def main():
    """Run position management workflow."""
    print("=" * 70)
    print("POSITION MANAGEMENT EXAMPLE")
    print("=" * 70)
    print()
    
    # Initialize agent
    print("1. Initializing agent...")
    agent = SwingScreenerAgent()
    await agent.start()
    print("   ✓ Agent started\n")
    
    # Review positions
    print("2. Reviewing open positions...")
    result = await agent.review_positions()
    print("   ✓ Review complete\n")
    
    positions = result.get("positions", [])
    
    if not positions:
        print("   No open positions to manage.\n")
    else:
        # Display position summary
        summary = result["summary"]
        print("3. Portfolio Summary:")
        print(f"   Total positions: {summary['total_positions']}")
        print(f"   Total value:     ${summary['total_value']:,.2f}")
        print(f"   Total P&L:       ${summary['total_pnl']:,.2f}")
        print(f"   Winners/Losers:  {summary['winners']}/{summary['losers']}")
        print()
        
        # Display each position
        print("4. Position Details:")
        print("   " + "-" * 66)
        
        for pos in positions:
            ticker = pos.get("ticker", "Unknown")
            entry = pos.get("entry_price", 0)
            current = pos.get("current_price", 0)
            stop = pos.get("stop_price", 0)
            pnl = pos.get("unrealized_pnl", 0)
            r_mult = pos.get("r_multiple", 0)
            
            status_emoji = "📈" if pnl >= 0 else "📉"
            
            print(f"\n   {status_emoji} {ticker}")
            print(f"      Entry:   ${entry:.2f}")
            print(f"      Current: ${current:.2f}")
            print(f"      Stop:    ${stop:.2f}")
            print(f"      P&L:     ${pnl:.2f} ({r_mult:.2f}R)")
        
        print("\n   " + "-" * 66)
        
        # Get stop suggestions
        print("\n5. Getting AI-powered stop suggestions...")
        suggestions_result = await agent.suggest_stop_updates()
        suggestions = suggestions_result.get("suggestions", [])
        
        if suggestions:
            print("   Stop Update Recommendations:")
            print("   " + "-" * 66)
            
            for sugg in suggestions:
                if sugg.get("should_update", False):
                    ticker = sugg.get("ticker", "Unknown")
                    current_stop = sugg.get("current_stop", 0)
                    suggested_stop = sugg.get("suggested_stop", 0)
                    reason = sugg.get("reason", "N/A")
                    
                    print(f"\n   ⚠️  {ticker}")
                    print(f"      Current stop:  ${current_stop:.2f}")
                    print(f"      Suggested:     ${suggested_stop:.2f}")
                    print(f"      Reason: {reason}")
            
            print("\n   " + "-" * 66)
        else:
            print("   ✓ No stop updates needed at this time\n")
        
        # Example: Update a stop (commented out - requires valid position_id)
        print("\n6. Example: Update a position stop")
        print("   (Commented out - requires valid position_id)")
        print("   Code:")
        print("   ```")
        print("   await agent.update_position_stop(")
        print("       position_id='pos_abc123',")
        print("       new_stop_price=185.00")
        print("   )")
        print("   ```\n")
    
    # Educational insights
    print("7. Educational Insights:")
    for insight in result["insights"]:
        if insight:
            print(f"   {insight}")
    print()
    
    # Stop agent
    print("8. Stopping agent...")
    await agent.stop()
    print("   ✓ Agent stopped\n")
    
    print("=" * 70)
    print("EXAMPLE COMPLETE")
    print("=" * 70)
    print("\nNext steps:")
    print("- Update stops for positions as recommended")
    print("- Execute stop updates at your broker")
    print("- Monitor positions for exit signals")
    print()


if __name__ == "__main__":
    asyncio.run(main())
