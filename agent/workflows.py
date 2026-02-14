"""Workflow orchestration for trading operations.

This module provides workflow classes that orchestrate multiple tool calls
to accomplish complex trading tasks.
"""
from __future__ import annotations

import logging
from typing import Any, Optional
from datetime import datetime

from agent.client import MCPClient

logger = logging.getLogger(__name__)


class BaseWorkflow:
    """Base class for trading workflows."""
    
    def __init__(self, client: MCPClient):
        """Initialize the workflow.
        
        Args:
            client: MCP client for tool execution
        """
        self.client = client
        self.insights: list[str] = []
    
    def add_insight(self, message: str) -> None:
        """Add an educational insight or observation.
        
        Args:
            message: Insight message
        """
        self.insights.append(message)
        logger.info("Insight: %s", message)
    
    def get_insights(self) -> list[str]:
        """Get all insights generated during workflow execution.
        
        Returns:
            List of insight messages
        """
        return self.insights.copy()


class ScreeningWorkflow(BaseWorkflow):
    """Workflow for screening stocks and identifying trade candidates."""
    
    async def execute(
        self,
        universe: str = "mega_all",
        strategy: Optional[str] = None,
        top_n: int = 10
    ) -> dict[str, Any]:
        """Execute the screening workflow.
        
        Args:
            universe: Stock universe to screen (default: mega_all)
            strategy: Strategy to use (default: active strategy)
            top_n: Number of top candidates to return
            
        Returns:
            Screening results with candidates and analysis
        """
        self.insights.clear()
        
        self.add_insight(f"Starting screening workflow for universe: {universe}")
        
        # Step 1: List available universes
        universes_result = await self.client.call_tool("list_universes", {})
        available_universes = universes_result.get("universes", [])
        
        if universe not in available_universes:
            self.add_insight(
                f"Warning: Universe '{universe}' not in available universes: {available_universes}"
            )
        
        # Step 2: Get active strategy if not specified
        if not strategy:
            strategy_result = await self.client.call_tool("get_active_strategy", {})
            strategy = strategy_result.get("id", "default")
            self.add_insight(f"Using active strategy: {strategy}")
        
        # Step 3: Run screener
        self.add_insight(f"Running screener on {universe} with strategy {strategy}...")
        
        screener_result = await self.client.call_tool("run_screener", {
            "universe": universe,
            "strategy": strategy,
            "top_n": top_n
        })
        
        candidates = screener_result.get("candidates", [])
        
        self.add_insight(f"Found {len(candidates)} candidates")
        
        # Step 4: Analyze candidates
        if candidates:
            self._analyze_candidates(candidates)
        else:
            self.add_insight("No candidates met the screening criteria. Consider:")
            self.add_insight("- Market conditions may not favor swing trades currently")
            self.add_insight("- Try a different universe or adjust strategy parameters")
        
        return {
            "candidates": candidates,
            "universe": universe,
            "strategy": strategy,
            "timestamp": datetime.now().isoformat(),
            "insights": self.get_insights()
        }
    
    def _analyze_candidates(self, candidates: list[dict]) -> None:
        """Analyze candidates and provide insights.
        
        Args:
            candidates: List of candidate stocks
        """
        if not candidates:
            return
        
        # Analyze momentum
        avg_momentum = sum(c.get("momentum_6m", 0) for c in candidates) / len(candidates)
        self.add_insight(f"Average 6-month momentum: {avg_momentum:.1%}")
        
        # Analyze volatility
        avg_atr_pct = sum(c.get("atr_percent", 0) for c in candidates) / len(candidates)
        self.add_insight(f"Average ATR%: {avg_atr_pct:.2%}")
        
        # Risk analysis
        max_risks = [c.get("max_loss_amount", 0) for c in candidates if "max_loss_amount" in c]
        if max_risks:
            avg_risk = sum(max_risks) / len(max_risks)
            self.add_insight(f"Average position risk (1R): ${avg_risk:.2f}")
        
        # Sector/category diversity
        categories = set(c.get("category", "Unknown") for c in candidates)
        self.add_insight(f"Sector diversity: {len(categories)} categories represented")
        
        # Educational insights
        self.add_insight("")
        self.add_insight("💡 Trading Tips:")
        self.add_insight("- Review each candidate's chart before trading")
        self.add_insight("- Ensure stop placement respects technical structure")
        self.add_insight("- Position size should match your risk tolerance")
        self.add_insight("- Consider correlation between selected candidates")


class OrderManagementWorkflow(BaseWorkflow):
    """Workflow for creating and managing orders."""
    
    async def execute(
        self,
        action: str = "list",
        **kwargs
    ) -> dict[str, Any]:
        """Execute order management workflow.
        
        Args:
            action: Action to perform (list, create, fill, cancel)
            **kwargs: Action-specific arguments
            
        Returns:
            Order management results
        """
        self.insights.clear()
        
        if action == "list":
            return await self._list_orders(**kwargs)
        elif action == "create":
            return await self._create_order(**kwargs)
        elif action == "fill":
            return await self._fill_order(**kwargs)
        elif action == "cancel":
            return await self._cancel_order(**kwargs)
        else:
            raise ValueError(f"Unknown action: {action}")
    
    async def _list_orders(self, status: Optional[str] = None) -> dict[str, Any]:
        """List orders with optional status filter."""
        self.add_insight(f"Listing orders (status={status or 'all'})")
        
        params = {}
        if status:
            params["status"] = status
        
        result = await self.client.call_tool("list_orders", params)
        orders = result.get("orders", [])
        
        self.add_insight(f"Found {len(orders)} orders")
        
        # Analyze orders by status
        pending = sum(1 for o in orders if o.get("status") == "pending")
        filled = sum(1 for o in orders if o.get("status") == "filled")
        cancelled = sum(1 for o in orders if o.get("status") == "cancelled")
        
        self.add_insight(f"Breakdown: {pending} pending, {filled} filled, {cancelled} cancelled")
        
        if pending > 0:
            self.add_insight("")
            self.add_insight("⚠️  Pending Orders:")
            self.add_insight("- Execute pending orders at your broker")
            self.add_insight("- Mark as filled in the system after execution")
            self.add_insight("- Cancel orders that are no longer valid")
        
        return {
            "orders": orders,
            "summary": {
                "total": len(orders),
                "pending": pending,
                "filled": filled,
                "cancelled": cancelled
            },
            "insights": self.get_insights()
        }
    
    async def _create_order(
        self,
        ticker: str,
        order_type: str,
        order_kind: str,
        **kwargs
    ) -> dict[str, Any]:
        """Create a new order."""
        self.add_insight(f"Creating {order_kind} {order_type} order for {ticker}")
        
        # Validate required fields
        if order_kind == "entry" and "entry_price" not in kwargs:
            raise ValueError("entry_price required for entry orders")
        if order_kind == "stop" and "stop_price" not in kwargs:
            raise ValueError("stop_price required for stop orders")
        
        # Preview position sizing for entry orders
        if order_kind == "entry" and "entry_price" in kwargs and "stop_price" in kwargs:
            preview = await self.client.call_tool("preview_order", {
                "entry_price": kwargs["entry_price"],
                "stop_price": kwargs["stop_price"]
            })
            
            shares = preview.get("shares", 0)
            position_value = preview.get("position_value", 0)
            risk_amount = preview.get("risk_amount", 0)
            
            self.add_insight(f"Position preview: {shares} shares, ${position_value:.2f} value")
            self.add_insight(f"Risk (1R): ${risk_amount:.2f}")
        
        # Create the order
        order_params = {
            "ticker": ticker,
            "order_type": order_type,
            "order_kind": order_kind,
            **kwargs
        }
        
        result = await self.client.call_tool("create_order", order_params)
        
        self.add_insight(f"Order created successfully: ID {result.get('order_id', 'unknown')}")
        self.add_insight("")
        self.add_insight("📋 Next Steps:")
        self.add_insight("1. Execute this order at your broker (e.g., Degiro)")
        self.add_insight("2. Return here to mark the order as filled")
        self.add_insight("3. Record the actual fill price and date")
        
        return {
            "order": result,
            "insights": self.get_insights()
        }
    
    async def _fill_order(
        self,
        order_id: str,
        fill_price: float,
        fill_date: str
    ) -> dict[str, Any]:
        """Fill an order."""
        self.add_insight(f"Filling order {order_id} at ${fill_price}")
        
        result = await self.client.call_tool("fill_order", {
            "order_id": order_id,
            "fill_price": fill_price,
            "fill_date": fill_date
        })
        
        self.add_insight("Order filled successfully")
        
        if result.get("position_created"):
            position_id = result.get("position_id")
            self.add_insight(f"Position created: {position_id}")
            self.add_insight("")
            self.add_insight("🎯 Position Management:")
            self.add_insight("- Monitor position for stop/target levels")
            self.add_insight("- Update trailing stop when position reaches +1.5R")
            self.add_insight("- Consider taking partial profits at +2R")
        
        return {
            "result": result,
            "insights": self.get_insights()
        }
    
    async def _cancel_order(self, order_id: str) -> dict[str, Any]:
        """Cancel an order."""
        self.add_insight(f"Cancelling order {order_id}")
        
        result = await self.client.call_tool("cancel_order", {
            "order_id": order_id
        })
        
        self.add_insight("Order cancelled successfully")
        
        return {
            "result": result,
            "insights": self.get_insights()
        }


class PositionManagementWorkflow(BaseWorkflow):
    """Workflow for managing open positions."""
    
    async def execute(
        self,
        action: str = "review",
        **kwargs
    ) -> dict[str, Any]:
        """Execute position management workflow.
        
        Args:
            action: Action to perform (review, update_stop, close, suggest_stops)
            **kwargs: Action-specific arguments
            
        Returns:
            Position management results
        """
        self.insights.clear()
        
        if action == "review":
            return await self._review_positions(**kwargs)
        elif action == "update_stop":
            return await self._update_stop(**kwargs)
        elif action == "close":
            return await self._close_position(**kwargs)
        elif action == "suggest_stops":
            return await self._suggest_stops(**kwargs)
        else:
            raise ValueError(f"Unknown action: {action}")
    
    async def _review_positions(self) -> dict[str, Any]:
        """Review all open positions."""
        self.add_insight("Reviewing open positions...")
        
        result = await self.client.call_tool("list_positions", {
            "status": "open"
        })
        
        positions = result.get("positions", [])
        
        self.add_insight(f"Found {len(positions)} open positions")
        
        if not positions:
            self.add_insight("No open positions to manage")
            return {
                "positions": [],
                "insights": self.get_insights()
            }
        
        # Analyze positions
        total_pnl = sum(p.get("unrealized_pnl", 0) for p in positions)
        total_value = sum(p.get("position_value", 0) for p in positions)
        
        winners = [p for p in positions if p.get("unrealized_pnl", 0) > 0]
        losers = [p for p in positions if p.get("unrealized_pnl", 0) < 0]
        
        self.add_insight(f"Portfolio value: ${total_value:.2f}")
        self.add_insight(f"Total unrealized P&L: ${total_pnl:.2f}")
        self.add_insight(f"Win rate: {len(winners)}/{len(positions)} positions profitable")
        
        # R-multiple analysis
        positions_with_r = [p for p in positions if "r_multiple" in p]
        if positions_with_r:
            avg_r = sum(p["r_multiple"] for p in positions_with_r) / len(positions_with_r)
            self.add_insight(f"Average R-multiple: {avg_r:.2f}R")
            
            # Identify positions needing stop updates
            needs_update = [p for p in positions if p.get("r_multiple", 0) >= 1.5]
            if needs_update:
                self.add_insight("")
                self.add_insight(f"⚠️  {len(needs_update)} position(s) ready for trailing stop:")
                for pos in needs_update:
                    ticker = pos.get("ticker", "Unknown")
                    r_mult = pos.get("r_multiple", 0)
                    self.add_insight(f"  - {ticker}: {r_mult:.2f}R (update stop to breakeven or above)")
        
        self.add_insight("")
        self.add_insight("📊 Position Management Tips:")
        self.add_insight("- Update stops on winners to lock in profits")
        self.add_insight("- Cut losers if they approach stop loss")
        self.add_insight("- Consider scaling out at resistance levels")
        self.add_insight("- Monitor correlation across your portfolio")
        
        return {
            "positions": positions,
            "summary": {
                "total_positions": len(positions),
                "total_value": total_value,
                "total_pnl": total_pnl,
                "winners": len(winners),
                "losers": len(losers)
            },
            "insights": self.get_insights()
        }
    
    async def _update_stop(
        self,
        position_id: str,
        new_stop_price: float
    ) -> dict[str, Any]:
        """Update trailing stop for a position."""
        self.add_insight(f"Updating stop for position {position_id} to ${new_stop_price}")
        
        # Get current position details
        position = await self.client.call_tool("get_position", {
            "position_id": position_id
        })
        
        current_stop = position.get("stop_price", 0)
        
        if new_stop_price <= current_stop:
            self.add_insight(
                f"Warning: New stop (${new_stop_price}) not higher than current (${current_stop})"
            )
        
        result = await self.client.call_tool("update_position_stop", {
            "position_id": position_id,
            "new_stop_price": new_stop_price
        })
        
        self.add_insight("Stop updated successfully")
        self.add_insight("")
        self.add_insight("📝 Remember:")
        self.add_insight("- Update stop order at your broker")
        self.add_insight("- Stop orders should trail price as position improves")
        self.add_insight("- Never lower a stop once raised")
        
        return {
            "result": result,
            "insights": self.get_insights()
        }
    
    async def _close_position(
        self,
        position_id: str,
        exit_price: float,
        exit_date: str
    ) -> dict[str, Any]:
        """Close a position."""
        self.add_insight(f"Closing position {position_id} at ${exit_price}")
        
        result = await self.client.call_tool("close_position", {
            "position_id": position_id,
            "exit_price": exit_price,
            "exit_date": exit_date
        })
        
        pnl = result.get("pnl", 0)
        r_multiple = result.get("r_multiple", 0)
        
        self.add_insight(f"Position closed: P&L ${pnl:.2f}, R-multiple: {r_multiple:.2f}R")
        
        if r_multiple > 0:
            self.add_insight("✅ Winner! Good trade execution")
        else:
            self.add_insight("❌ Loss taken - part of systematic trading")
        
        self.add_insight("")
        self.add_insight("📈 Post-Trade Review:")
        self.add_insight("- What went right/wrong?")
        self.add_insight("- Did you follow your plan?")
        self.add_insight("- Any lessons for future trades?")
        
        return {
            "result": result,
            "insights": self.get_insights()
        }
    
    async def _suggest_stops(self) -> dict[str, Any]:
        """Get AI-powered stop suggestions for all open positions."""
        self.add_insight("Analyzing positions for stop price suggestions...")
        
        # Get open positions
        positions_result = await self.client.call_tool("list_positions", {
            "status": "open"
        })
        
        positions = positions_result.get("positions", [])
        suggestions = []
        
        for pos in positions:
            position_id = pos.get("position_id")
            if position_id:
                try:
                    suggestion = await self.client.call_tool("suggest_position_stop", {
                        "position_id": position_id
                    })
                    suggestions.append(suggestion)
                except Exception as e:
                    self.add_insight(f"Could not get suggestion for {position_id}: {e}")
        
        self.add_insight(f"Generated {len(suggestions)} stop price suggestions")
        
        # Analyze suggestions
        needs_update = [s for s in suggestions if s.get("should_update", False)]
        if needs_update:
            self.add_insight(f"{len(needs_update)} positions recommended for stop updates")
        else:
            self.add_insight("No stop updates recommended at this time")
        
        return {
            "suggestions": suggestions,
            "insights": self.get_insights()
        }
