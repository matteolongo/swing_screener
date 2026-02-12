# MCP Usage Guide

This guide explains how to use the Swing Screener MCP (Model Context Protocol) server and agent.

## Overview

The MCP implementation provides:
- **MCP Server**: Exposes screening, order, and position management as tools
- **Agent**: AI-driven automation for daily trading workflows
- **Configurable Prompts**: Tune information density and tone

## Architecture

```
┌─────────────────┐
│   AI Assistant  │ (Claude, GPT, etc.)
└────────┬────────┘
         │ MCP Protocol
┌────────▼────────┐
│   MCP Server    │ (mcp_server/server.py)
└────────┬────────┘
         │ Python API
┌────────▼────────┐
│  API Services   │ (FastAPI endpoints)
└────────┬────────┘
         │
┌────────▼────────┐
│ Core Framework  │ (screener, portfolio, etc.)
└─────────────────┘
```

## Quick Start

### 1. Start the MCP Server

```bash
cd /path/to/swing_screener
python -m mcp_server.server
```

The server runs on stdio and waits for MCP protocol messages.

### 2. Use the Agent CLI

```bash
# Run daily workflow (screening + positions + orders)
python -m mcp_server.agent --workflow daily

# Run just screening
python -m mcp_server.agent --workflow screen --universe mega_all

# Run with educational mode
python -m mcp_server.agent --workflow screen --style educational --educational

# Manage positions only
python -m mcp_server.agent --workflow positions --tone friendly
```

### 3. Agent Configuration Options

**Prompt Styles** (information density):
- `concise` - Brief, action-oriented responses
- `balanced` - Clear explanations with key metrics (default)
- `detailed` - Thorough analysis with full context
- `educational` - Teaching mode with concept explanations

**Prompt Tones** (communication style):
- `professional` - Formal, business-like (default)
- `friendly` - Conversational and approachable
- `technical` - Precise technical language

**Example Configurations**:

```bash
# For quick daily checks
python -m mcp_server.agent --workflow daily --style concise

# For learning and understanding
python -m mcp_server.agent --workflow screen --style educational --educational

# For detailed analysis
python -m mcp_server.agent --workflow positions --style detailed --tone technical
```

## Available MCP Tools

The MCP server exposes 15 tools organized by category:

### Screener Tools

1. **list_universes** - List available stock universes
   ```json
   {}
   ```

2. **run_screener** - Run screener on a universe
   ```json
   {
     "universe": "mega_all",
     "max_results": 20
   }
   ```

3. **preview_order** - Preview order calculations
   ```json
   {
     "ticker": "AAPL",
     "entry_price": 150.0,
     "stop_price": 145.0,
     "account_size": 50000,
     "risk_pct": 0.01
   }
   ```

### Position Management Tools

4. **list_positions** - Get all positions
   ```json
   {
     "status": "open"  // optional: "open" or "closed"
   }
   ```

5. **get_position** - Get specific position
   ```json
   {
     "position_id": "AAPL_20240212"
   }
   ```

6. **get_position_stop_suggestion** - Get stop update suggestion
   ```json
   {
     "position_id": "AAPL_20240212"
   }
   ```

7. **update_position_stop** - Update trailing stop
   ```json
   {
     "position_id": "AAPL_20240212",
     "new_stop": 148.0,
     "reason": "Trailing stop to protect 2R profit"
   }
   ```

8. **close_position** - Close a position
   ```json
   {
     "position_id": "AAPL_20240212",
     "close_price": 155.0,
     "reason": "Target reached"
   }
   ```

### Order Management Tools

9. **list_orders** - Get all orders
   ```json
   {
     "status": "pending",  // optional
     "ticker": "AAPL"      // optional
   }
   ```

10. **get_order** - Get specific order
    ```json
    {
      "order_id": "order_123"
    }
    ```

11. **create_order** - Create new order
    ```json
    {
      "ticker": "AAPL",
      "order_type": "LIMIT",
      "entry_price": 150.0,
      "stop_price": 145.0,
      "quantity": 50,
      "notes": "Breakout setup"
    }
    ```

12. **fill_order** - Mark order as filled
    ```json
    {
      "order_id": "order_123",
      "fill_price": 150.5
    }
    ```

13. **cancel_order** - Cancel pending order
    ```json
    {
      "order_id": "order_123"
    }
    ```

### Configuration Tools

14. **get_config** - Get application configuration
    ```json
    {}
    ```

## Agent Workflows

The agent provides high-level workflows that combine multiple tool calls:

### 1. Daily Screening Workflow

```python
from mcp_server.agent import SwingScreenerAgent, AgentConfig, PromptStyle

config = AgentConfig(
    style=PromptStyle.BALANCED,
    max_candidates=20,
    auto_preview=True
)

agent = SwingScreenerAgent(config)
results = await agent.run_daily_screening(universe="mega_all")

# Returns:
# - candidates: List of ranked candidates
# - analysis: Text analysis based on prompt style
# - order_previews: Position sizing for top 3 candidates
# - recommendation: Action items
```

### 2. Position Management Workflow

```python
results = await agent.manage_positions()

# Returns:
# - position_analysis: For each position:
#   - Current position details
#   - Stop price suggestion
#   - Recommendation (hold/update/close)
# - summary: Overall portfolio status
```

### 3. Order Management Workflow

```python
results = await agent.manage_orders(status="pending")

# Returns:
# - orders: List of orders matching filter
# - summary: Order status overview
```

### 4. Complete Daily Routine

```python
results = await agent.run_daily_routine(universe="mega_all")

# Returns combined results from:
# - Screening workflow
# - Position management workflow
# - Order management workflow
```

## Configuration File

Create `mcp_server/agent_config.yaml`:

```yaml
# Prompt style: concise, balanced, detailed, educational
style: balanced

# Prompt tone: professional, friendly, technical
tone: professional

# Screening settings
max_candidates: 20
auto_preview: true
educational_mode: false

# Account settings
account_size: 50000
risk_pct: 0.01

# Default universe
default_universe: mega_all
```

## Integration with AI Assistants

### Claude Desktop Configuration

Add to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "swing-screener": {
      "command": "python",
      "args": ["/path/to/swing_screener/mcp_server/server.py"],
      "cwd": "/path/to/swing_screener"
    }
  }
}
```

### Using with the Agent

The agent can be used programmatically:

```python
import asyncio
from mcp_server.agent import SwingScreenerAgent, AgentConfig, PromptStyle, PromptTone

async def main():
    # Configure agent
    config = AgentConfig(
        style=PromptStyle.DETAILED,
        tone=PromptTone.FRIENDLY,
        max_candidates=10,
        educational_mode=True
    )
    
    # Create agent
    agent = SwingScreenerAgent(config)
    
    # Connect to MCP server
    await agent.connect()
    
    # Run daily routine
    results = await agent.run_daily_routine(universe="sp500")
    
    # Process results
    print(f"Found {results['screening']['total_candidates']} candidates")
    print(f"Managing {results['positions']['total_positions']} positions")
    print(f"Pending orders: {results['orders']['total_orders']}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Example Conversations

### Concise Style

**User**: "Screen the mega_all universe"

**Agent**: "Top candidates:
1. NVDA (score: 8.5)
2. META (score: 7.9)
3. MSFT (score: 7.2)

3 recommended out of 15 candidates."

### Educational Style

**User**: "Screen the mega_all universe"

**Agent**: "Screening Analysis (Educational):

The screener ranks candidates based on trend, momentum, and volatility.
Found 15 candidates. Top 5:

1. NVDA - Score: 8.5
   Recommended: Yes
   → Strong trend + momentum + manageable volatility
   
   Educational note: A score of 8.5 indicates strong trend (price above SMA),
   positive momentum (6-12 month returns), and reasonable ATR for risk management.

2. META - Score: 7.9
   Recommended: Yes
   → Solid uptrend with good momentum

..."

### Detailed Style with Position Management

**User**: "Analyze my positions"

**Agent**: "Comprehensive position analysis:

Position 1: NVDA
- Entry: $850.00, Current Stop: $820.00
- Current R: 2.3R (up $23 on $10 initial risk)
- P&L: +$1,150 (23%)

Recommendation: Update stop to $840 (trailing stop) to protect 2R profit.
This follows our manage rule: once position reaches 2R, trail stop to entry +1R.

Position 2: META
- Entry: $480.00, Current Stop: $470.00
- Current R: 0.8R (up $8 on $10 initial risk)
- P&L: +$400 (8%)

Recommendation: Hold current stop. Position hasn't reached breakeven threshold yet.
Monitor for 1R milestone before adjusting stop.

Portfolio summary: 2 positions, both profitable. Consider trailing stop on NVDA."

## Customizing Prompts

To add new prompt styles or modify existing ones, edit `mcp_server/prompts.py`:

```python
SYSTEM_PROMPTS[PromptStyle.CUSTOM] = """
Your custom system prompt here...
"""

TASK_PROMPTS["screening"][PromptStyle.CUSTOM] = """
Custom task-specific prompt for screening...
"""
```

## Troubleshooting

### MCP Server Won't Start

- Ensure all dependencies are installed: `pip install -e ".[dev]" && pip install mcp`
- Check that FastAPI services are accessible
- Verify paths in server.py are correct

### Tool Calls Fail

- Check that data files exist: `data/positions.json`, `data/orders.json`
- Verify configuration in `config.json`
- Review logs for detailed error messages

### Agent Connection Issues

- Ensure MCP server is running
- Check stdio connection setup
- Verify Python path includes project root

## Best Practices

1. **Start with balanced style** - Good mix of detail and brevity
2. **Use educational mode when learning** - Understand concepts, not just actions
3. **Run daily routine after market close** - Systematic review
4. **Preview orders before creating** - Verify position sizing
5. **Review stop suggestions regularly** - Protect profits

## Advanced Usage

### Custom Workflows

Create custom workflows by combining tool calls:

```python
async def custom_workflow(agent):
    # 1. Screen for candidates
    screening = await agent.run_daily_screening("mega_all")
    
    # 2. Filter for high-confidence setups
    top_candidates = [
        c for c in screening["candidates"]
        if c["is_recommended"] and c["score"] > 7.0
    ]
    
    # 3. Preview orders for each
    for candidate in top_candidates:
        preview = await agent.preview_order(
            ticker=candidate["ticker"],
            entry_price=candidate["entry_price"],
            stop_price=candidate["stop_price"]
        )
        
        # 4. Auto-create orders if position size is acceptable
        if preview["position_size_dollars"] < 5000:
            # Create order
            pass
```

### Integration with External Systems

The MCP protocol allows integration with any system that speaks MCP:
- AI chat interfaces (Claude, ChatGPT)
- Automation tools
- Custom dashboards
- Notification systems

## Further Reading

- **Model Context Protocol**: https://modelcontextprotocol.io/
- **FastAPI Documentation**: See `api/README.md`
- **Swing Screener Framework**: See `AGENTS.md`
- **Daily Workflows**: See `docs/OPERATIONAL_GUIDE.md`
