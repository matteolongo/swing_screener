"""Agent implementation for Swing Screener MCP.

This module provides an AI agent that interacts with the MCP server
to automate trading workflows like screening, order management, and
position management.
"""
from __future__ import annotations

import json
import logging
import asyncio
from typing import Any, Optional, List, Dict
from pathlib import Path
from dataclasses import dataclass

from mcp import ClientSession, stdio_client

from mcp_server.prompts import (
    PromptStyle,
    PromptTone,
    get_system_prompt,
    get_task_prompt,
    DEFAULT_STYLE,
    DEFAULT_TONE,
)

logger = logging.getLogger(__name__)


@dataclass
class AgentConfig:
    """Configuration for the agent behavior."""
    style: PromptStyle = DEFAULT_STYLE
    tone: PromptTone = DEFAULT_TONE
    max_candidates: int = 20
    auto_preview: bool = True  # Auto-preview top candidates
    educational_mode: bool = False  # Add educational explanations
    
    @classmethod
    def from_dict(cls, config: Dict[str, Any]) -> AgentConfig:
        """Create config from dictionary."""
        return cls(
            style=PromptStyle(config.get("style", DEFAULT_STYLE)),
            tone=PromptTone(config.get("tone", DEFAULT_TONE)),
            max_candidates=config.get("max_candidates", 20),
            auto_preview=config.get("auto_preview", True),
            educational_mode=config.get("educational_mode", False),
        )


class SwingScreenerAgent:
    """AI agent for interacting with Swing Screener via MCP."""
    
    def __init__(self, config: Optional[AgentConfig] = None):
        """Initialize the agent with configuration.
        
        Args:
            config: Agent configuration for prompts and behavior
        """
        self.config = config or AgentConfig()
        self.session: Optional[ClientSession] = None
        self.tools: Dict[str, Any] = {}
        
    async def connect(self):
        """Connect to the MCP server."""
        # Get the path to the MCP server script
        server_path = Path(__file__).parent / "server.py"
        
        # Start the MCP server as a subprocess
        server_params = stdio_client(
            "python",
            [str(server_path)],
        )
        
        # Connect to the server
        async with server_params as (read, write):
            async with ClientSession(read, write) as session:
                self.session = session
                await session.initialize()
                
                # List available tools
                tools_list = await session.list_tools()
                self.tools = {tool.name: tool for tool in tools_list.tools}
                logger.info(f"Connected to MCP server with {len(self.tools)} tools")
    
    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        """Call an MCP tool and return the result.
        
        Args:
            name: Tool name
            arguments: Tool arguments
            
        Returns:
            Tool result as parsed JSON
        """
        if not self.session:
            raise RuntimeError("Not connected to MCP server. Call connect() first.")
        
        result = await self.session.call_tool(name, arguments)
        
        # Parse the text content as JSON
        if result.content and len(result.content) > 0:
            text = result.content[0].text
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                # Return as-is if not JSON
                return {"result": text}
        
        return None
    
    # ===== High-level workflow methods =====
    
    async def run_daily_screening(self, universe: str = "mega_all") -> Dict[str, Any]:
        """Run the daily screening workflow.
        
        This is the main entry point for the daily screening process:
        1. List available universes
        2. Run screener on selected universe
        3. Analyze top candidates
        4. Optionally preview orders for top candidates
        
        Args:
            universe: Universe to screen (default: mega_all)
            
        Returns:
            Dict with screening results and analysis
        """
        logger.info(f"Starting daily screening workflow for {universe}")
        
        # Get system prompt
        system_prompt = get_system_prompt(self.config.style, self.config.tone)
        task_prompt = get_task_prompt(
            "screening",
            style=self.config.style,
            n=self.config.max_candidates
        )
        
        # Run screener
        result = await self.call_tool("run_screener", {
            "universe": universe,
            "max_results": self.config.max_candidates,
        })
        
        if not result or "candidates" not in result:
            return {"error": "No screening results", "details": result}
        
        candidates = result["candidates"]
        logger.info(f"Found {len(candidates)} candidates")
        
        # Analyze top candidates
        analysis = self._analyze_candidates(candidates, task_prompt)
        
        # Auto-preview top candidates if enabled
        previews = []
        if self.config.auto_preview and len(candidates) > 0:
            # Preview top 3 candidates
            for candidate in candidates[:3]:
                preview = await self.preview_order(
                    ticker=candidate["ticker"],
                    entry_price=candidate.get("entry_price", candidate.get("close")),
                    stop_price=candidate.get("stop_price", candidate.get("close") * 0.95),
                )
                if preview:
                    previews.append(preview)
        
        return {
            "universe": universe,
            "total_candidates": len(candidates),
            "candidates": candidates,
            "analysis": analysis,
            "order_previews": previews,
            "recommendation": self._generate_screening_recommendation(candidates, analysis),
        }
    
    async def preview_order(self, 
                          ticker: str,
                          entry_price: float,
                          stop_price: float,
                          account_size: float = 50000,
                          risk_pct: float = 0.01) -> Optional[Dict[str, Any]]:
        """Preview an order with position sizing calculations.
        
        Args:
            ticker: Stock ticker
            entry_price: Intended entry price
            stop_price: Stop loss price
            account_size: Account size in dollars
            risk_pct: Risk percentage per trade (e.g., 0.01 = 1%)
            
        Returns:
            Order preview with position size calculations
        """
        try:
            result = await self.call_tool("preview_order", {
                "ticker": ticker,
                "entry_price": entry_price,
                "stop_price": stop_price,
                "account_size": account_size,
                "risk_pct": risk_pct,
            })
            return result
        except Exception as e:
            logger.error(f"Error previewing order for {ticker}: {e}")
            return None
    
    async def manage_positions(self) -> Dict[str, Any]:
        """Run the position management workflow.
        
        This workflow:
        1. Lists all open positions
        2. Gets stop suggestions for each position
        3. Analyzes position status (R values, P&L)
        4. Provides recommendations
        
        Returns:
            Dict with position analysis and recommendations
        """
        logger.info("Starting position management workflow")
        
        # Get system prompt
        system_prompt = get_system_prompt(self.config.style, self.config.tone)
        task_prompt = get_task_prompt(
            "position_management",
            style=self.config.style
        )
        
        # List open positions
        positions_response = await self.call_tool("list_positions", {"status": "open"})
        
        if not positions_response or "positions" not in positions_response:
            return {"positions": [], "message": "No open positions"}
        
        positions = positions_response["positions"]
        logger.info(f"Managing {len(positions)} open positions")
        
        # Get stop suggestions for each position
        position_analysis = []
        for position in positions:
            pos_id = position["position_id"]
            
            # Get stop suggestion
            suggestion = await self.call_tool("get_position_stop_suggestion", {
                "position_id": pos_id
            })
            
            analysis = {
                "position": position,
                "stop_suggestion": suggestion,
                "recommendation": self._analyze_position(position, suggestion),
            }
            position_analysis.append(analysis)
        
        return {
            "total_positions": len(positions),
            "position_analysis": position_analysis,
            "summary": self._generate_position_summary(position_analysis),
        }
    
    async def manage_orders(self, status: str = "pending") -> Dict[str, Any]:
        """Manage orders workflow.
        
        Args:
            status: Filter orders by status (pending, filled, cancelled)
            
        Returns:
            Dict with order analysis
        """
        logger.info(f"Managing {status} orders")
        
        # List orders
        orders_response = await self.call_tool("list_orders", {"status": status})
        
        if not orders_response or "orders" not in orders_response:
            return {"orders": [], "message": f"No {status} orders"}
        
        orders = orders_response["orders"]
        
        return {
            "total_orders": len(orders),
            "orders": orders,
            "summary": f"Found {len(orders)} {status} orders",
        }
    
    async def run_daily_routine(self, universe: str = "mega_all") -> Dict[str, Any]:
        """Run the complete daily trading routine.
        
        This combines all workflows:
        1. Screen for new candidates
        2. Review open positions
        3. Review pending orders
        
        Args:
            universe: Universe to screen
            
        Returns:
            Complete daily routine results
        """
        logger.info("Starting complete daily routine")
        
        task_prompt = get_task_prompt("daily_workflow", style=self.config.style)
        
        # Run screening
        screening_results = await self.run_daily_screening(universe)
        
        # Manage positions
        position_results = await self.manage_positions()
        
        # Manage orders
        order_results = await self.manage_orders(status="pending")
        
        return {
            "routine": "daily_review",
            "screening": screening_results,
            "positions": position_results,
            "orders": order_results,
            "workflow_guidance": task_prompt,
        }
    
    # ===== Helper methods for analysis =====
    
    def _analyze_candidates(self, candidates: List[Dict[str, Any]], prompt: str) -> str:
        """Analyze screening candidates based on prompt style."""
        if not candidates:
            return "No candidates found."
        
        if self.config.style == PromptStyle.CONCISE:
            # Just list top 5 with key metrics
            lines = ["Top candidates:"]
            for i, c in enumerate(candidates[:5], 1):
                ticker = c.get("ticker", "?")
                rank = c.get("rank", i)
                score = c.get("score", 0)
                lines.append(f"{rank}. {ticker} (score: {score:.2f})")
            return "\n".join(lines)
        
        elif self.config.style == PromptStyle.EDUCATIONAL:
            # Add educational context
            lines = [
                "Screening Analysis (Educational):",
                "",
                "The screener ranks candidates based on trend, momentum, and volatility.",
                f"Found {len(candidates)} candidates. Top 5:",
                ""
            ]
            for i, c in enumerate(candidates[:5], 1):
                ticker = c.get("ticker", "?")
                rank = c.get("rank", i)
                score = c.get("score", 0)
                recommended = c.get("is_recommended", False)
                
                lines.append(f"{rank}. {ticker} - Score: {score:.2f}")
                lines.append(f"   Recommended: {'Yes' if recommended else 'No'}")
                
                # Add educational notes
                if recommended:
                    lines.append("   → Strong trend + momentum + manageable volatility")
                else:
                    lines.append("   → Review indicators before trading")
                lines.append("")
            
            return "\n".join(lines)
        
        else:
            # Balanced or detailed
            lines = [f"Screening Analysis - {len(candidates)} candidates found:", ""]
            for i, c in enumerate(candidates[:10], 1):
                ticker = c.get("ticker", "?")
                rank = c.get("rank", i)
                score = c.get("score", 0)
                recommended = c.get("is_recommended", False)
                
                lines.append(f"{rank}. {ticker} - Score: {score:.2f} - {'✓ Recommended' if recommended else '⚠ Review'}")
            
            return "\n".join(lines)
    
    def _generate_screening_recommendation(self, 
                                         candidates: List[Dict[str, Any]],
                                         analysis: str) -> str:
        """Generate recommendation based on screening results."""
        if not candidates:
            return "No candidates found. Consider adjusting filters or trying a different universe."
        
        recommended = [c for c in candidates if c.get("is_recommended", False)]
        
        if self.config.style == PromptStyle.CONCISE:
            return f"{len(recommended)} recommended out of {len(candidates)} candidates."
        
        return (
            f"Found {len(candidates)} candidates, {len(recommended)} recommended. "
            f"Review top candidates and create orders for best setups."
        )
    
    def _analyze_position(self, 
                         position: Dict[str, Any],
                         suggestion: Optional[Dict[str, Any]]) -> str:
        """Analyze a single position."""
        ticker = position.get("ticker", "?")
        r_now = position.get("r_now", 0)
        
        if self.config.style == PromptStyle.CONCISE:
            if r_now >= 2:
                return f"{ticker}: {r_now:.1f}R - Consider trailing stop"
            elif r_now > 0:
                return f"{ticker}: {r_now:.1f}R - Hold"
            else:
                return f"{ticker}: {r_now:.1f}R - Monitor closely"
        
        # More detailed analysis
        if r_now >= 2:
            return (
                f"{ticker} is up {r_now:.1f}R. "
                f"Consider updating stop to protect profits (trailing stop)."
            )
        elif r_now > 0:
            return f"{ticker} is up {r_now:.1f}R. Hold and monitor."
        else:
            return f"{ticker} is down {abs(r_now):.1f}R. Review stop loss."
    
    def _generate_position_summary(self, 
                                  position_analysis: List[Dict[str, Any]]) -> str:
        """Generate summary of position analysis."""
        if not position_analysis:
            return "No open positions to manage."
        
        total = len(position_analysis)
        profitable = sum(1 for p in position_analysis 
                        if p["position"].get("r_now", 0) > 0)
        
        if self.config.style == PromptStyle.CONCISE:
            return f"{profitable}/{total} positions profitable"
        
        return (
            f"Portfolio summary: {total} open positions, "
            f"{profitable} profitable. Review stop suggestions and update as needed."
        )


# ===== CLI Interface =====

async def main():
    """Main entry point for the agent CLI."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Swing Screener MCP Agent - Automated trading workflows"
    )
    parser.add_argument(
        "--workflow",
        choices=["screen", "positions", "orders", "daily"],
        default="daily",
        help="Workflow to run (default: daily)",
    )
    parser.add_argument(
        "--universe",
        default="mega_all",
        help="Universe to screen (default: mega_all)",
    )
    parser.add_argument(
        "--style",
        choices=[s.value for s in PromptStyle],
        default=DEFAULT_STYLE.value,
        help="Prompt style (default: balanced)",
    )
    parser.add_argument(
        "--tone",
        choices=[t.value for t in PromptTone],
        default=DEFAULT_TONE.value,
        help="Prompt tone (default: professional)",
    )
    parser.add_argument(
        "--max-candidates",
        type=int,
        default=20,
        help="Maximum candidates to analyze (default: 20)",
    )
    parser.add_argument(
        "--educational",
        action="store_true",
        help="Enable educational mode with detailed explanations",
    )
    
    args = parser.parse_args()
    
    # Create agent config
    config = AgentConfig(
        style=PromptStyle(args.style),
        tone=PromptTone(args.tone),
        max_candidates=args.max_candidates,
        educational_mode=args.educational,
    )
    
    # Create and run agent
    agent = SwingScreenerAgent(config)
    
    try:
        # Note: Connection to MCP server needs to be established
        # This is a placeholder - actual MCP client connection would go here
        logger.info(f"Starting workflow: {args.workflow}")
        logger.info(f"Style: {args.style}, Tone: {args.tone}")
        
        # For now, just print configuration
        print(f"\n=== Swing Screener Agent ===")
        print(f"Workflow: {args.workflow}")
        print(f"Universe: {args.universe}")
        print(f"Style: {args.style} | Tone: {args.tone}")
        print(f"Max candidates: {args.max_candidates}")
        print(f"Educational mode: {args.educational}")
        print("\nTo run workflows, use the MCP client connection.")
        print("See docs/MCP_USAGE_GUIDE.md for examples.")
        
    except Exception as e:
        logger.error(f"Error running agent: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    asyncio.run(main())
