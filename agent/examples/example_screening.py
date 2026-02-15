"""Example: Daily screening workflow.

This example demonstrates how to use the agent for the daily
screening routine to find trade candidates.
"""
import asyncio
import json
from agent import SwingScreenerAgent


async def main():
    """Run daily screening workflow."""
    print("=" * 70)
    print("DAILY SCREENING EXAMPLE")
    print("=" * 70)
    print()
    
    # Initialize agent
    print("1. Initializing agent...")
    agent = SwingScreenerAgent()
    await agent.start()
    print("   ✓ Agent started\n")
    
    # Run screening
    print("2. Running screening on mega_all universe...")
    result = await agent.daily_screening(
        universe="mega_all",
        top_n=5  # Get top 5 candidates
    )
    print("   ✓ Screening complete\n")
    
    # Display candidates
    print("3. Top Candidates:")
    print("   " + "-" * 66)
    
    if result["candidates"]:
        for i, candidate in enumerate(result["candidates"], 1):
            ticker = candidate.get("ticker", "Unknown")
            entry = candidate.get("entry_price", 0)
            stop = candidate.get("stop_price", 0)
            momentum = candidate.get("momentum_6m", 0)
            
            print(f"\n   {i}. {ticker}")
            print(f"      Entry: ${entry:.2f}")
            print(f"      Stop:  ${stop:.2f}")
            print(f"      Risk:  ${entry - stop:.2f} per share")
            print(f"      Momentum: {momentum:.1%}")
    else:
        print("\n   No candidates found. Market conditions may not favor swing trades.")
    
    print("\n   " + "-" * 66)
    
    # Educational insights are already printed by the agent
    # but we can access them programmatically too
    print("\n4. Educational Insights:")
    for insight in result["insights"]:
        if insight:  # Skip empty lines
            print(f"   {insight}")
    
    # Save results
    print("\n5. Saving results to screening_results.json...")
    with open("screening_results.json", "w") as f:
        json.dump(result, f, indent=2)
    print("   ✓ Results saved\n")
    
    # Stop agent
    print("6. Stopping agent...")
    await agent.stop()
    print("   ✓ Agent stopped\n")
    
    print("=" * 70)
    print("EXAMPLE COMPLETE")
    print("=" * 70)
    print("\nNext steps:")
    print("- Review candidates in screening_results.json")
    print("- Check charts for each ticker")
    print("- Use 'create_order_from_candidate()' to place orders")
    print()


if __name__ == "__main__":
    asyncio.run(main())
