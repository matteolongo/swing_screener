"""Main Swing Screener Agent implementation.

This module provides the main agent class that orchestrates workflows
and provides a high-level interface for AI-driven trading automation.
"""
from __future__ import annotations

import logging
from typing import Any, Optional
from datetime import datetime

from agent.client import MCPClient
from agent.workflows import (
    ScreeningWorkflow,
    OrderManagementWorkflow,
    PositionManagementWorkflow,
)

logger = logging.getLogger(__name__)


class SwingScreenerAgent:
    """AI-driven agent for automating Swing Screener workflows.
    
    This agent connects to the MCP server and provides high-level methods
    for common trading workflows:
    - Daily screening routine
    - Order creation and management
    - Position management with stop updates
    - Educational insights and analysis
    
    Example:
        ```python
        agent = SwingScreenerAgent()
        await agent.start()
        
        # Run daily screening
        result = await agent.daily_screening()
        print(result["insights"])
        
        # Review positions
        positions = await agent.review_positions()
        
        await agent.stop()
        ```
    """
    
    def __init__(self, server_command: Optional[list[str]] = None):
        """Initialize the agent.
        
        Args:
            server_command: Custom command to start MCP server.
                           Defaults to ["python", "-m", "mcp_server.main"]
        """
        self.client = MCPClient(server_command)
        self.screening_workflow = None
        self.order_workflow = None
        self.position_workflow = None
        self.is_running = False
    
    async def start(self) -> None:
        """Start the agent and connect to MCP server."""
        logger.info("Starting Swing Screener Agent...")
        
        await self.client.connect()
        
        # Initialize workflows
        self.screening_workflow = ScreeningWorkflow(self.client)
        self.order_workflow = OrderManagementWorkflow(self.client)
        self.position_workflow = PositionManagementWorkflow(self.client)
        
        self.is_running = True
        logger.info("Agent started successfully")
        
        # Log available tools
        tools = self.client.get_available_tools()
        logger.info(f"Available tools: {len(tools)}")
        logger.debug(f"Tool list: {tools}")
    
    async def stop(self) -> None:
        """Stop the agent and disconnect from MCP server."""
        logger.info("Stopping Swing Screener Agent...")
        
        await self.client.disconnect()
        self.is_running = False
        
        logger.info("Agent stopped")
    
    def _check_running(self) -> None:
        """Check if agent is running."""
        if not self.is_running:
            raise RuntimeError("Agent not started. Call agent.start() first.")
    
    async def daily_screening(
        self,
        universe: str = "mega_all",
        strategy: Optional[str] = None,
        top_n: int = 10
    ) -> dict[str, Any]:
        """Execute the daily screening workflow.
        
        This is the main workflow for finding new trade candidates:
        1. Lists available universes
        2. Gets active strategy
        3. Runs screener with filters
        4. Analyzes candidates
        5. Provides educational insights
        
        Args:
            universe: Stock universe to screen (default: mega_all)
            strategy: Strategy to use (default: active strategy)
            top_n: Number of top candidates to return
            
        Returns:
            Screening results with candidates and insights
        """
        self._check_running()
        
        logger.info(f"Running daily screening: universe={universe}, top_n={top_n}")
        
        result = await self.screening_workflow.execute(
            universe=universe,
            strategy=strategy,
            top_n=top_n
        )
        
        # Print insights to console
        print("\n" + "=" * 60)
        print("DAILY SCREENING RESULTS")
        print("=" * 60)
        print(f"Universe: {result['universe']}")
        print(f"Strategy: {result['strategy']}")
        print(f"Candidates found: {len(result['candidates'])}")
        print("\nInsights:")
        for insight in result['insights']:
            print(f"  {insight}")
        print("=" * 60 + "\n")
        
        return result
    
    async def create_order_from_candidate(
        self,
        candidate: dict[str, Any]
    ) -> dict[str, Any]:
        """Create an entry order from a screening candidate.
        
        Args:
            candidate: Screening candidate with entry/stop prices
            
        Returns:
            Order creation result with insights
        """
        self._check_running()
        
        ticker = candidate.get("ticker")
        entry_price = candidate.get("entry_price")
        stop_price = candidate.get("stop_price")
        
        if not all([ticker, entry_price, stop_price]):
            raise ValueError("Candidate must have ticker, entry_price, and stop_price")
        
        logger.info(f"Creating order for candidate: {ticker}")
        
        result = await self.order_workflow.execute(
            action="create",
            ticker=ticker,
            order_type="LIMIT",
            order_kind="entry",
            entry_price=entry_price,
            stop_price=stop_price,
            limit_price=entry_price
        )
        
        return result
    
    async def review_positions(self) -> dict[str, Any]:
        """Review all open positions with analysis.
        
        Returns:
            Position review results with insights
        """
        self._check_running()
        
        logger.info("Reviewing open positions")
        
        result = await self.position_workflow.execute(action="review")
        
        # Print insights to console
        print("\n" + "=" * 60)
        print("POSITION REVIEW")
        print("=" * 60)
        print(f"Open positions: {result['summary']['total_positions']}")
        print(f"Total P&L: ${result['summary']['total_pnl']:.2f}")
        print("\nInsights:")
        for insight in result['insights']:
            print(f"  {insight}")
        print("=" * 60 + "\n")
        
        return result
    
    async def suggest_stop_updates(self) -> dict[str, Any]:
        """Get AI-powered stop price suggestions for all open positions.
        
        Returns:
            Stop suggestions with insights
        """
        self._check_running()
        
        logger.info("Getting stop price suggestions")
        
        result = await self.position_workflow.execute(action="suggest_stops")
        
        return result
    
    async def update_position_stop(
        self,
        position_id: str,
        new_stop_price: float
    ) -> dict[str, Any]:
        """Update trailing stop for a position.
        
        Args:
            position_id: Position identifier
            new_stop_price: New stop price (must be higher than current)
            
        Returns:
            Update result with insights
        """
        self._check_running()
        
        logger.info(f"Updating stop for position {position_id}")
        
        result = await self.position_workflow.execute(
            action="update_stop",
            position_id=position_id,
            new_stop_price=new_stop_price
        )
        
        return result
    
    async def list_orders(
        self,
        status: Optional[str] = None
    ) -> dict[str, Any]:
        """List orders with optional status filter.
        
        Args:
            status: Filter by status (pending, filled, cancelled, or None for all)
            
        Returns:
            Order list with summary and insights
        """
        self._check_running()
        
        logger.info(f"Listing orders: status={status or 'all'}")
        
        result = await self.order_workflow.execute(
            action="list",
            status=status
        )
        
        return result
    
    async def fill_order(
        self,
        order_id: str,
        fill_price: float,
        fill_date: Optional[str] = None
    ) -> dict[str, Any]:
        """Mark an order as filled after broker execution.
        
        Args:
            order_id: Order identifier
            fill_price: Actual fill price from broker
            fill_date: Fill date (default: today)
            
        Returns:
            Fill result with insights
        """
        self._check_running()
        
        if fill_date is None:
            fill_date = datetime.now().strftime("%Y-%m-%d")
        
        logger.info(f"Filling order {order_id} at ${fill_price}")
        
        result = await self.order_workflow.execute(
            action="fill",
            order_id=order_id,
            fill_price=fill_price,
            fill_date=fill_date
        )
        
        return result
    
    async def close_position(
        self,
        position_id: str,
        exit_price: float,
        exit_date: Optional[str] = None
    ) -> dict[str, Any]:
        """Close a position.
        
        Args:
            position_id: Position identifier
            exit_price: Exit price
            exit_date: Exit date (default: today)
            
        Returns:
            Close result with P&L and insights
        """
        self._check_running()
        
        if exit_date is None:
            exit_date = datetime.now().strftime("%Y-%m-%d")
        
        logger.info(f"Closing position {position_id} at ${exit_price}")
        
        result = await self.position_workflow.execute(
            action="close",
            position_id=position_id,
            exit_price=exit_price,
            exit_date=exit_date
        )
        
        return result
    
    async def daily_review(self) -> dict[str, Any]:
        """Execute comprehensive daily review workflow.
        
        This combines screening and position management:
        1. Reviews open positions
        2. Runs screening for new candidates
        3. Identifies positions needing stop updates
        4. Provides consolidated insights
        
        Returns:
            Comprehensive daily review results
        """
        self._check_running()
        
        logger.info("Starting comprehensive daily review")
        
        # Use the daily_review tool if available
        try:
            result = await self.client.call_tool("get_daily_review", {})
            
            print("\n" + "=" * 60)
            print("DAILY REVIEW")
            print("=" * 60)
            print(f"Date: {datetime.now().strftime('%Y-%m-%d')}")
            print("\n" + result.get("summary", ""))
            print("=" * 60 + "\n")
            
            return result
            
        except Exception as e:
            logger.warning(f"Daily review tool not available: {e}")
            
            # Fallback: run workflows separately
            positions = await self.review_positions()
            screening = await self.daily_screening()
            
            return {
                "positions": positions,
                "screening": screening,
                "timestamp": datetime.now().isoformat()
            }
    
    def get_available_tools(self) -> list[str]:
        """Get list of available MCP tools.
        
        Returns:
            List of tool names
        """
        return self.client.get_available_tools()
