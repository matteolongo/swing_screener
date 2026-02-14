"""Example: Complete daily workflow.

This example demonstrates a full daily trading routine:
1. Review open positions
2. Run screening for new candidates
3. Create orders for selected candidates
4. Update stops as needed
"""
import asyncio
from datetime import datetime
from agent import SwingScreenerAgent


async def main():
    """Run complete daily workflow."""
    print("=" * 70)
    print("DAILY WORKFLOW EXAMPLE")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 70)
    print()
    
    # Initialize agent
    print("⏳ Initializing Swing Screener Agent...")
    agent = SwingScreenerAgent()
    await agent.start()
    print("✓ Agent ready\n")
    
    # STEP 1: Daily Review (if available)
    print("=" * 70)
    print("STEP 1: DAILY REVIEW")
    print("=" * 70)
    
    try:
        daily_review = await agent.daily_review()
        print("✓ Daily review complete")
        print()
    except Exception as e:
        print(f"⚠️  Daily review not available: {e}")
        print("   Falling back to individual workflows...\n")
    
    # STEP 2: Review Positions
    print("=" * 70)
    print("STEP 2: REVIEW OPEN POSITIONS")
    print("=" * 70)
    print()
    
    positions_result = await agent.review_positions()
    positions = positions_result.get("positions", [])
    
    print(f"Open Positions: {len(positions)}")
    
    if positions:
        # Show positions needing attention
        high_performers = [p for p in positions if p.get("r_multiple", 0) >= 1.5]
        
        if high_performers:
            print(f"\n⚠️  {len(high_performers)} position(s) ready for trailing stop update:")
            for pos in high_performers:
                ticker = pos.get("ticker", "Unknown")
                r_mult = pos.get("r_multiple", 0)
                print(f"   - {ticker}: {r_mult:.2f}R")
    
    print()
    
    # STEP 3: Run Screening
    print("=" * 70)
    print("STEP 3: SCREEN FOR NEW CANDIDATES")
    print("=" * 70)
    print()
    
    screening_result = await agent.daily_screening(
        universe="mega_all",
        top_n=5
    )
    
    candidates = screening_result.get("candidates", [])
    print(f"\nCandidates Found: {len(candidates)}")
    
    if candidates:
        print("\nTop 3 Candidates:")
        for i, candidate in enumerate(candidates[:3], 1):
            ticker = candidate.get("ticker", "Unknown")
            entry = candidate.get("entry_price", 0)
            stop = candidate.get("stop_price", 0)
            risk_per_share = entry - stop
            
            print(f"\n{i}. {ticker}")
            print(f"   Entry: ${entry:.2f}")
            print(f"   Stop:  ${stop:.2f}")
            print(f"   Risk:  ${risk_per_share:.2f}/share")
    
    print()
    
    # STEP 4: Example Order Creation
    print("=" * 70)
    print("STEP 4: ORDER CREATION (EXAMPLE)")
    print("=" * 70)
    print()
    
    if candidates:
        print("Example: Create order for top candidate")
        print("(This would create a pending order in the system)")
        print()
        
        top_candidate = candidates[0]
        ticker = top_candidate.get("ticker", "Unknown")
        
        print(f"Selected: {ticker}")
        print(f"Entry: ${top_candidate.get('entry_price', 0):.2f}")
        print(f"Stop:  ${top_candidate.get('stop_price', 0):.2f}")
        print()
        print("Code to create order:")
        print("```python")
        print("order_result = await agent.create_order_from_candidate(top_candidate)")
        print("```")
        print()
        print("⚠️  Remember to:")
        print("   1. Execute order at your broker (e.g., Degiro)")
        print("   2. Mark order as filled using fill_order()")
        print("   3. Record actual fill price and date")
    else:
        print("No candidates to order")
    
    print()
    
    # STEP 5: List Pending Orders
    print("=" * 70)
    print("STEP 5: PENDING ORDERS CHECK")
    print("=" * 70)
    print()
    
    orders_result = await agent.list_orders(status="pending")
    pending_orders = orders_result.get("orders", [])
    
    if pending_orders:
        print(f"⚠️  {len(pending_orders)} pending order(s) need execution:")
        for order in pending_orders:
            ticker = order.get("ticker", "Unknown")
            order_id = order.get("order_id", "Unknown")
            order_type = order.get("order_type", "Unknown")
            
            print(f"\n   • {ticker} ({order_type})")
            print(f"     Order ID: {order_id}")
        
        print("\n📋 Next steps:")
        print("   1. Execute these orders at your broker")
        print("   2. Use 'agent.fill_order()' to mark as filled")
    else:
        print("✓ No pending orders")
    
    print()
    
    # STEP 6: Summary
    print("=" * 70)
    print("DAILY WORKFLOW SUMMARY")
    print("=" * 70)
    print()
    
    print(f"✓ Positions reviewed: {len(positions)}")
    print(f"✓ New candidates: {len(candidates)}")
    print(f"✓ Pending orders: {len(pending_orders)}")
    
    if high_performers:
        print(f"⚠️ Stops to update: {len(high_performers)}")
    
    print()
    print("Recommended Actions:")
    print("1. Update stops for high-performing positions")
    print("2. Execute pending orders at broker")
    print("3. Review charts for new candidates")
    print("4. Create orders for selected candidates")
    print()
    
    # Stop agent
    print("⏳ Stopping agent...")
    await agent.stop()
    print("✓ Agent stopped\n")
    
    print("=" * 70)
    print("DAILY WORKFLOW COMPLETE")
    print("=" * 70)
    print()


if __name__ == "__main__":
    asyncio.run(main())
