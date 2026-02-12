"""Example usage of the Swing Screener MCP Agent.

This script demonstrates how to use the agent for various workflows.
"""
import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from mcp_server.agent import SwingScreenerAgent, AgentConfig
from mcp_server.prompts import PromptStyle, PromptTone

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def example_concise_screening():
    """Example: Quick daily screening with concise output."""
    print("\n" + "="*60)
    print("Example 1: Concise Daily Screening")
    print("="*60 + "\n")
    
    config = AgentConfig(
        style=PromptStyle.CONCISE,
        tone=PromptTone.PROFESSIONAL,
        max_candidates=10,
    )
    
    agent = SwingScreenerAgent(config)
    
    # Note: This would need MCP server connection
    print("Configuration:")
    print(f"  Style: {config.style.value}")
    print(f"  Tone: {config.tone.value}")
    print(f"  Max candidates: {config.max_candidates}")
    print("\nThis would run screening and show concise results.")


async def example_educational_analysis():
    """Example: Educational mode for learning."""
    print("\n" + "="*60)
    print("Example 2: Educational Analysis")
    print("="*60 + "\n")
    
    config = AgentConfig(
        style=PromptStyle.EDUCATIONAL,
        tone=PromptTone.FRIENDLY,
        max_candidates=5,
        educational_mode=True,
    )
    
    agent = SwingScreenerAgent(config)
    
    print("Configuration:")
    print(f"  Style: {config.style.value} (with educational mode)")
    print(f"  Tone: {config.tone.value}")
    print(f"  Max candidates: {config.max_candidates}")
    print("\nThis would provide detailed explanations of:")
    print("  - Why candidates are ranked as they are")
    print("  - What indicators mean (trend, momentum, ATR)")
    print("  - How R-based position sizing works")
    print("  - When and why to update stops")


async def example_position_management():
    """Example: Managing open positions."""
    print("\n" + "="*60)
    print("Example 3: Position Management")
    print("="*60 + "\n")
    
    config = AgentConfig(
        style=PromptStyle.DETAILED,
        tone=PromptTone.TECHNICAL,
    )
    
    agent = SwingScreenerAgent(config)
    
    print("Configuration:")
    print(f"  Style: {config.style.value}")
    print(f"  Tone: {config.tone.value}")
    print("\nThis would:")
    print("  1. List all open positions")
    print("  2. Calculate current R values")
    print("  3. Get stop price suggestions")
    print("  4. Provide detailed recommendations")


async def example_custom_workflow():
    """Example: Custom workflow combining multiple operations."""
    print("\n" + "="*60)
    print("Example 4: Complete Daily Routine")
    print("="*60 + "\n")
    
    config = AgentConfig(
        style=PromptStyle.BALANCED,
        tone=PromptTone.PROFESSIONAL,
        max_candidates=20,
        auto_preview=True,
    )
    
    agent = SwingScreenerAgent(config)
    
    print("Configuration:")
    print(f"  Style: {config.style.value}")
    print(f"  Tone: {config.tone.value}")
    print(f"  Auto-preview: {config.auto_preview}")
    print("\nDaily routine would:")
    print("  1. Screen universe for candidates")
    print("  2. Preview orders for top 3 candidates (if auto_preview=True)")
    print("  3. Review all open positions")
    print("  4. Check pending orders")
    print("  5. Provide summary and recommendations")


async def main():
    """Run all examples."""
    print("\n" + "="*80)
    print("Swing Screener MCP Agent - Usage Examples")
    print("="*80)
    
    # Run examples
    await example_concise_screening()
    await example_educational_analysis()
    await example_position_management()
    await example_custom_workflow()
    
    print("\n" + "="*80)
    print("Next Steps:")
    print("="*80)
    print("\n1. Start the MCP server:")
    print("   python -m mcp_server.server")
    print("\n2. Use the agent CLI:")
    print("   python -m mcp_server.agent --workflow daily --style balanced")
    print("\n3. Or integrate with AI assistants (Claude Desktop, etc.)")
    print("   See docs/MCP_USAGE_GUIDE.md for configuration")
    print("\n4. For programmatic usage, connect the agent to the MCP server:")
    print("   await agent.connect()")
    print("   results = await agent.run_daily_routine()")
    print()


if __name__ == "__main__":
    asyncio.run(main())
