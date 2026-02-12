# MCP Server - Swing Screener

Model Context Protocol (MCP) integration for Swing Screener.

## Overview

This directory contains the MCP server and AI agent implementation that exposes swing trading capabilities through the Model Context Protocol.

## Components

### 1. MCP Server (`server.py`)

Exposes 15 trading tools via MCP:

**Screener Tools:**
- `list_universes` - List available stock universes
- `run_screener` - Run screener on a universe
- `preview_order` - Preview position sizing calculations

**Position Management:**
- `list_positions` - Get all positions
- `get_position` - Get specific position details
- `get_position_stop_suggestion` - Get stop update suggestions
- `update_position_stop` - Update trailing stops
- `close_position` - Close a position

**Order Management:**
- `list_orders` - Get all orders
- `get_order` - Get specific order
- `create_order` - Create new order
- `fill_order` - Mark order as filled
- `cancel_order` - Cancel pending order

**Configuration:**
- `get_config` - Get app configuration

### 2. Agent (`agent.py`)

AI-driven agent that orchestrates MCP tools for automated workflows:

- **Daily Screening** - Screen universe, analyze candidates, preview orders
- **Position Management** - Review positions, update stops, close positions
- **Order Management** - Review and manage pending orders
- **Daily Routine** - Complete end-to-end workflow

### 3. Configurable Prompts (`prompts.py`)

Tunable prompt templates with:

**Styles** (information density):
- `concise` - Brief, action-oriented
- `balanced` - Clear with key metrics
- `detailed` - Thorough analysis
- `educational` - Teaching mode with explanations

**Tones** (communication style):
- `professional` - Formal, business-like
- `friendly` - Conversational
- `technical` - Precise technical language

### 4. Configuration (`agent_config.yaml`)

YAML configuration for agent behavior:
```yaml
style: balanced
tone: professional
max_candidates: 20
auto_preview: true
educational_mode: false
```

## Quick Start

### 1. Start MCP Server

```bash
cd /path/to/swing_screener
python -m mcp_server.server
```

The server runs on stdio and communicates via MCP protocol.

### 2. Use Agent CLI

```bash
# Daily routine (screening + positions + orders)
python -m mcp_server.agent --workflow daily

# Just screening
python -m mcp_server.agent --workflow screen --universe mega_all

# Educational mode
python -m mcp_server.agent --workflow screen --style educational --educational

# Position management
python -m mcp_server.agent --workflow positions --style detailed
```

### 3. Programmatic Usage

```python
from mcp_server.agent import SwingScreenerAgent, AgentConfig, PromptStyle

config = AgentConfig(
    style=PromptStyle.BALANCED,
    max_candidates=20,
)

agent = SwingScreenerAgent(config)

# Connect to MCP server
await agent.connect()

# Run workflows
screening = await agent.run_daily_screening("mega_all")
positions = await agent.manage_positions()
orders = await agent.manage_orders()

# Complete routine
daily = await agent.run_daily_routine("mega_all")
```

## Integration with AI Assistants

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

Then chat with Claude:
- "Screen the mega_all universe"
- "Show me my open positions"
- "Create an order for AAPL at $150 with stop at $145"

## Testing

```bash
# Run MCP tests
pytest tests/test_mcp/ -v

# Test coverage
pytest tests/test_mcp/ --cov=mcp_server --cov-report=html
```

## Architecture

```
┌─────────────────┐
│  AI Assistant   │ (Claude, GPT, Custom)
└────────┬────────┘
         │ MCP Protocol (stdio)
┌────────▼────────┐
│   MCP Server    │ (15 tools)
│  (server.py)    │
└────────┬────────┘
         │ Python API
┌────────▼────────┐
│  API Services   │ (FastAPI)
│  - Screener     │
│  - Portfolio    │
│  - Config       │
└────────┬────────┘
         │
┌────────▼────────┐
│ Core Framework  │
│ - Indicators    │
│ - Screeners     │
│ - Risk Engine   │
└─────────────────┘
```

## Configuration Examples

### For Quick Daily Checks
```bash
python -m mcp_server.agent --workflow daily --style concise
```

### For Learning
```bash
python -m mcp_server.agent --workflow screen --style educational --educational
```

### For Detailed Analysis
```bash
python -m mcp_server.agent --workflow positions --style detailed --tone technical
```

## Files

- `server.py` - MCP server with 15 tools
- `agent.py` - AI agent with workflow automation
- `prompts.py` - Configurable prompt templates
- `agent_config.yaml` - Default configuration
- `__init__.py` - Package initialization

## Documentation

- **Complete guide**: `docs/MCP_USAGE_GUIDE.md`
- **API reference**: `api/README.md`
- **Framework docs**: `AGENTS.md`

## Dependencies

```bash
pip install mcp>=1.0.0 pyyaml>=6.0
```

Already included in `pyproject.toml`.

## Best Practices

1. **Start with balanced style** - Good mix of detail and brevity
2. **Use educational mode when learning** - Understand concepts
3. **Run daily routine after market close** - Systematic review
4. **Preview orders before creating** - Verify position sizing
5. **Review stop suggestions regularly** - Protect profits

## Development

### Adding New Tools

1. Add tool to `list_tools()` in `server.py`
2. Add handler in `call_tool()` in `server.py`
3. Add tests in `tests/test_mcp/`
4. Update documentation

### Adding New Prompts

1. Add style or tone to `prompts.py`
2. Add to enum (PromptStyle or PromptTone)
3. Add templates to dicts
4. Add tests

### Running Examples

```bash
python examples/mcp_agent_usage.py
```

## Troubleshooting

**Server won't start:**
- Ensure dependencies installed: `pip install -e ".[dev]"`
- Check that API services are accessible
- Verify data files exist

**Tool calls fail:**
- Check `data/positions.json` exists
- Check `data/orders.json` exists
- Verify `config.json` is valid
- Review logs for errors

**Agent connection issues:**
- Ensure MCP server is running
- Check stdio connection
- Verify Python path

## Future Enhancements

- Additional workflow templates
- Custom prompt loading from files
- Multi-universe screening
- Batch order operations
- Performance analytics
- Risk monitoring alerts

## License

MIT
