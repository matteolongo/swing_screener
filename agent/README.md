# Swing Screener Agent

AI-driven workflow automation for Swing Screener via Model Context Protocol (MCP).

## Overview

The Swing Screener Agent is an intelligent automation layer that connects to the MCP server to orchestrate trading workflows. It provides:

- **Automated screening** for trade candidates
- **Order management** (creation, filling, cancellation)
- **Position management** with stop updates
- **Educational insights** and analysis on every action
- **Natural language interface** for trading operations

The agent acts as an MCP client, calling the 22 available MCP tools to mimic the daily trading routine while providing explanations and feedback.

## Capabilities

- **Daily screening**: `daily_screening()` for candidate discovery
- **Order creation**: `create_order_from_candidate()` from screening output
- **Position review**: `review_positions()` with categorization
- **Stop suggestions**: `suggest_stop_updates()` and `update_position_stop()`
- **Order management**: `list_orders()` and `fill_order()`
- **Position exits**: `close_position()`
- **Daily review**: `daily_review()` (uses MCP tool if available, otherwise fallbacks)

## Architecture

```
┌─────────────────────────────────────┐
│   Swing Screener Agent              │
│   (Python Client)                   │
│                                     │
│   ┌──────────────────────────────┐ │
│   │  SwingScreenerAgent          │ │
│   │  - daily_screening()         │ │
│   │  - review_positions()        │ │
│   │  - create_order()            │ │
│   │  - update_stop()             │ │
│   └──────────────────────────────┘ │
│                │                    │
│   ┌────────────┴──────────────────┐│
│   │  Workflows                    ││
│   │  - ScreeningWorkflow          ││
│   │  - OrderManagementWorkflow    ││
│   │  - PositionManagementWorkflow ││
│   └───────────────────────────────┘│
│                │                    │
│   ┌────────────┴──────────────────┐│
│   │  MCPClient                    ││
│   │  - connect()                  ││
│   │  - call_tool()                ││
│   │  - disconnect()               ││
│   └───────────────────────────────┘│
└─────────────┬───────────────────────┘
              │ stdio (JSON-RPC)
              ↓
┌─────────────────────────────────────┐
│   MCP Server                        │
│   (22 tools across 6 domains)       │
│                                     │
│   • Portfolio (9 tools)             │
│   • Screener (3 tools)              │
│   • Strategy (4 tools)              │
│   • Config (2 tools)                │
│   • Daily Review (2 tools)          │
│   • Social (2 tools)                │
└─────────────────────────────────────┘
```

## Installation

The agent is part of the main swing_screener package with MCP dependencies:

```bash
# Install with MCP support
pip install -e ".[mcp]"

# Verify installation
python -m agent.cli tools
```

## Quick Start

### Command-Line Interface

The simplest way to use the agent is via the CLI:

```bash
# Run daily screening
python -m agent.cli screen --universe mega_all --top 10

# Review open positions
python -m agent.cli positions review

# List pending orders
python -m agent.cli orders list --status pending

# Get stop price suggestions
python -m agent.cli positions suggest-stops

# Run comprehensive daily review
python -m agent.cli daily-review
```

### Python API

For programmatic use or integration into other tools:

```python
import asyncio
from agent import SwingScreenerAgent

async def main():
    # Initialize and start the agent
    agent = SwingScreenerAgent()
    await agent.start()
    
    # Run daily screening
    screening = await agent.daily_screening(universe="mega_all", top_n=10)
    
    # Print insights
    for insight in screening["insights"]:
        print(insight)
    
    # Review positions
    positions = await agent.review_positions()
    
    # Create order from candidate
    if screening["candidates"]:
        candidate = screening["candidates"][0]
        order = await agent.create_order_from_candidate(candidate)
    
    # Stop the agent
    await agent.stop()

asyncio.run(main())
```

## Usage Examples

### Example 1: Daily Screening Workflow

```bash
# Run screening on mega_all universe, get top 10 candidates
python -m agent.cli screen --universe mega_all --top 10 --output results.json
```

Output:
```
============================================================
DAILY SCREENING RESULTS
============================================================
Universe: mega_all
Strategy: default
Candidates found: 10

Insights:
  Starting screening workflow for universe: mega_all
  Using active strategy: default
  Running screener on mega_all with strategy default...
  Found 10 candidates
  Average 6-month momentum: 15.2%
  Average ATR%: 2.45%
  Average position risk (1R): $98.50
  Sector diversity: 8 categories represented
  
  💡 Trading Tips:
  - Review each candidate's chart before trading
  - Ensure stop placement respects technical structure
  - Position size should match your risk tolerance
  - Consider correlation between selected candidates
============================================================

📊 Top Candidates:

1. AAPL
   Entry: $182.50
   Stop:  $178.20
   Momentum: 18.5%
   Rank Score: 0.92

2. MSFT
   Entry: $385.00
   Stop:  $378.50
   Momentum: 16.2%
   Rank Score: 0.89

...
```

### Example 2: Position Management

```bash
# Review open positions
python -m agent.cli positions review
```

Output:
```
============================================================
POSITION REVIEW
============================================================
Open positions: 5
Total P&L: $1,245.50

Insights:
  Reviewing open positions...
  Found 5 open positions
  Portfolio value: $25,430.00
  Total unrealized P&L: $1,245.50
  Win rate: 4/5 positions profitable
  Average R-multiple: 1.85R
  
  ⚠️  2 position(s) ready for trailing stop:
    - AAPL: 2.10R (update stop to breakeven or above)
    - NVDA: 1.75R (update stop to breakeven or above)
  
  📊 Position Management Tips:
  - Update stops on winners to lock in profits
  - Cut losers if they approach stop loss
  - Consider scaling out at resistance levels
  - Monitor correlation across your portfolio
============================================================

📈 Open Positions:

📈 AAPL
   Entry: $180.00 → Current: $187.80
   P&L: $390.00 (2.10R)

📈 MSFT
   Entry: $380.00 → Current: $386.40
   P&L: $320.00 (1.60R)

...
```

### Example 3: Order Management

```bash
# List pending orders
python -m agent.cli orders list --status pending

# Fill an order after broker execution
python -m agent.cli orders fill order_abc123 175.50 --fill-date 2026-02-12
```

### Example 4: Stop Updates

```bash
# Get AI-powered stop suggestions
python -m agent.cli positions suggest-stops

# Update a position's stop price
python -m agent.cli positions update-stop pos_xyz789 185.00
```

## Workflows

### ScreeningWorkflow

Orchestrates stock screening:

1. Lists available universes
2. Gets active strategy (if not specified)
3. Runs screener with filters
4. Analyzes candidates (momentum, volatility, risk)
5. Provides educational insights

**Educational Insights:**
- Average momentum and volatility metrics
- Risk per position (1R)
- Sector diversity analysis
- Trading tips and best practices

### OrderManagementWorkflow

Handles order lifecycle:

**Actions:**
- `list` - List orders with status filter
- `create` - Create new orders with position preview
- `fill` - Mark orders as filled
- `cancel` - Cancel pending orders

**Educational Insights:**
- Order status breakdown
- Position sizing preview
- Next steps after order creation
- Execution reminders

### PositionManagementWorkflow

Manages open positions:

**Actions:**
- `review` - Review all positions with P&L analysis
- `update_stop` - Update trailing stops
- `close` - Close positions
- `suggest_stops` - AI-powered stop suggestions

**Educational Insights:**
- Portfolio P&L and win rate
- R-multiple analysis
- Positions needing stop updates
- Position management best practices

## Configuration

The agent uses the MCP server configuration from `config/mcp_features.yaml`:

```yaml
server:
  name: "swing-screener-mcp"
  version: "0.1.0"

environment: "dev"

features:
  portfolio:
    enabled: true
  screener:
    enabled: true
  strategy:
    enabled: true
  config:
    enabled: true
  daily_review:
    enabled: true
  social:
    enabled: true

logging:
  level: "INFO"
```

## Advanced Usage

### Custom Server Command

Start the agent with a custom MCP server command:

```python
agent = SwingScreenerAgent(
    server_command=["python", "-m", "mcp_server.main", "--config", "custom_config.yaml"]
)
```

### Error Handling

```python
from agent import SwingScreenerAgent

async def safe_screening():
    agent = SwingScreenerAgent()
    
    try:
        await agent.start()
        result = await agent.daily_screening()
        return result
    except ValueError as e:
        print(f"Invalid input: {e}")
    except RuntimeError as e:
        print(f"Server error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
    finally:
        await agent.stop()
```

### Logging

```python
import logging

# Enable debug logging for agent
logging.basicConfig(level=logging.DEBUG)
logging.getLogger("agent").setLevel(logging.DEBUG)

# Or via CLI
python -m agent.cli screen --log-level DEBUG
```

## Integration with AI Assistants

The agent can be integrated with AI assistants like Claude Desktop:

### Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "swing-screener": {
      "command": "python",
      "args": ["-m", "mcp_server.main"],
      "cwd": "/path/to/swing_screener"
    }
  }
}
```

Then interact naturally:

```
User: "Run the daily screening and show me the top 5 candidates"
Claude: [Uses run_screener tool] "Here are the top 5 candidates from mega_all universe..."

User: "Create an entry order for AAPL at $180 with a stop at $175"
Claude: [Uses create_order and preview_order tools] "Order created. This will require 
         50 shares with a position value of $9,000 and risk of $250..."
```

## Troubleshooting

### Agent Won't Start

```bash
# Check MCP server directly
python -m mcp_server.main --validate-only

# Check dependencies
pip install -e ".[mcp]"
```

### Tool Not Found

```bash
# List available tools
python -m agent.cli tools

# Check MCP feature configuration
cat config/mcp_features.yaml
```

### Connection Issues

The agent communicates via stdio. Ensure:
- MCP server is in Python path
- No conflicting processes on stdio
- Proper permissions to execute server

## Development

### Running Tests

```bash
# Run agent tests (when implemented)
pytest tests/agent/ -v

# Test MCP server integration
python -m mcp_server.main --validate-only
```

### Adding Custom Workflows

```python
from agent.workflows import BaseWorkflow

class CustomWorkflow(BaseWorkflow):
    async def execute(self, **kwargs):
        self.add_insight("Starting custom workflow...")
        
        # Call MCP tools
        result = await self.client.call_tool("tool_name", {})
        
        self.add_insight("Workflow complete")
        
        return {
            "result": result,
            "insights": self.get_insights()
        }
```

## Educational Philosophy

The agent is designed to be **educational first**:

- Every action includes insights explaining what's happening
- Risk metrics are prominently displayed
- Trading tips and best practices are provided
- Encourages systematic, rule-based decision making
- Reminds user of manual execution steps (broker integration)

This aligns with Swing Screener's philosophy: **simple, transparent, risk-first trading**.

## Limitations

The agent is intentionally conservative:

- **No auto-execution** - All broker execution is manual
- **No high-frequency trading** - Designed for daily workflows
- **No ML/curve-fitting** - Uses rule-based logic only
- **No discretionary overrides** - Follows systematic rules

This is by design. Swing Screener values **clarity over cleverness**.

## Next Steps

1. **Try the CLI** - Run `python -m agent.cli daily-review`
2. **Explore the code** - See `agent/agent.py` for API
3. **Integrate with Claude** - Add to Claude Desktop config
4. **Build custom workflows** - Extend `BaseWorkflow`

## Support

- **Documentation**: See `docs/overview/INDEX.md`
- **Issues**: GitHub Issues
- **MCP Server**: See `mcp_server/README.md`

---

**Related Documentation:**
- [MCP Server README](../mcp_server/README.md)
- [MCP Server Implementation Guide](../mcp_server/docs/MCP_SERVER_COMPLETE.md)
- [Daily Usage Guide](../docs/product/DAILY_USAGE_GUIDE.md)
- [Operational Guide](../docs/engineering/OPERATIONAL_GUIDE.md)
