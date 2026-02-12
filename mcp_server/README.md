# MCP Server - Swing Screener

Model Context Protocol (MCP) server for Swing Screener, exposing trading system functionality to AI assistants and other MCP-compatible clients.

## Status

**Phase 1:** ✅ Complete - Infrastructure (config, registry, skeleton)  
**Phase 2:** ✅ Complete - Portfolio tools + MCP protocol integration  
**Phase 3:** ✅ Complete - Portfolio domain complete (9 tools) + Screener tools (3 tools)  
**Phase 4:** ✅ Complete - All remaining domains (strategy, config, daily_review, social)

**Total:** 22 tools across 6 feature domains

### Currently Available

- **9 Portfolio Tools** - Complete position and order management
- **3 Screener Tools** - Stock screening and position sizing
- **4 Strategy Tools** - Strategy management and configuration
- **2 Config Tools** - Application configuration management
- **2 Daily Review Tools** - Comprehensive daily trading workflow
- **2 Social Tools** - Social sentiment analysis
- **MCP Protocol** - Stdio transport for AI assistant communication
- **Configuration** - YAML-based feature toggles
- **Tool Registry** - Multi-domain support

## Quick Start

### Installation

```bash
# Install with MCP dependencies
pip install -e ".[mcp]"
```

### Running the Server

```bash
# Start MCP server (stdio transport)
python -m mcp_server.main

# Validate configuration only
python -m mcp_server.main --validate-only

# Use custom config
python -m mcp_server.main --config /path/to/config.yaml
```

### Available Tools

**Portfolio Management (9 tools):**

1. **list_positions** - List all trading positions
   - Filter by status (open/closed)
   - Returns positions with current prices

2. **get_position** - Get position details by ID
   - Includes entry, stop, and current price
   - Shows R-multiples and P&L

3. **update_position_stop** - Update trailing stop
   - Raises stop price only (trailing stop logic)
   - Auto-creates new stop orders

4. **list_orders** - List all orders
   - Filter by status (pending/filled/cancelled)
   - Filter by ticker

5. **create_order** - Create new order
   - Supports LIMIT, STOP, MARKET types
   - Entry/stop/target order kinds

6. **suggest_position_stop** - AI-powered stop suggestions
   - Based on R-multiples and trailing stop rules
   - Considers technical indicators

7. **close_position** - Manually close position
   - Records exit price and date
   - Marks position as closed

8. **fill_order** - Mark order as filled
   - Creates position for entry orders
   - Records fill price and date

9. **cancel_order** - Cancel pending order
   - Only pending orders can be cancelled

**Screener & Analysis (3 tools):**

1. **run_screener** - Execute stock screening
   - Filter by technical criteria
   - Rank by momentum indicators
   - Returns top candidates with entry/stop prices
   - Supports multiple universes and strategies

2. **list_universes** - List available stock universes
   - Shows all configured universes (mega_all, sp500, etc.)

3. **preview_order** - Calculate position sizing
   - Given entry and stop prices
   - Returns share quantity, position size, risk amount

**Strategy Management (4 tools):**

1. **list_strategies** - List all available strategies
   - Shows all configured trading strategies

2. **get_strategy** - Get strategy details by ID
   - Returns complete strategy configuration

3. **get_active_strategy** - Get currently active strategy
   - Returns the strategy currently in use

4. **set_active_strategy** - Set a strategy as active
   - Activates a specific strategy for trading

**Configuration Management (2 tools):**

1. **get_config** - Retrieve current configuration
   - Returns all app configuration settings

2. **update_config** - Update configuration
   - Supports partial updates to config
   - 22 fields across risk, indicators, manage sections

**Daily Review (2 tools):**

1. **get_daily_review** - Generate comprehensive daily review
   - Combines screener + portfolio data
   - Returns daily trading workflow summary

2. **get_candidate_recommendations** - Get filtered candidates
   - Returns recommended trading candidates
   - Configurable top_n parameter

**Social Sentiment (2 tools):**

1. **get_social_sentiment** - Get social sentiment for ticker
   - Real-time social sentiment data

2. **analyze_ticker_sentiment** - Comprehensive sentiment analysis
   - Detailed ticker sentiment breakdown

### Configuration

Configuration is loaded from `config/mcp_features.yaml`:

```yaml
server:
  name: "swing-screener-mcp"
  version: "0.1.0"

environment: "dev"  # dev | staging | prod

features:
  portfolio:
    enabled: false  # Enable/disable entire feature domain
    tools:
      - list_positions
      - get_position
      # ... more tools
  
  screener:
    enabled: false
    tools:
      - run_screener
      - list_universes

logging:
  level: "INFO"  # DEBUG | INFO | WARNING | ERROR
```

### Testing

```bash
# Phase 1 tests (configuration and registry)
PYTHONPATH=. python -m pytest tests/mcp_server/ -v

# Or run individual test files with explicit path setup
cd tests/mcp_server
python -m pytest test_config.py -v
```

## Architecture

### Service Layer Reuse

The MCP server **reuses the existing service layer** from `api/services/` without modification:

- Services are interface-agnostic (no HTTP coupling)
- Services use domain exceptions (not FastAPI HTTPException)
- Services are stateless and use dependency injection
- Same DI pattern as FastAPI layer (`mcp_server/dependencies.py`)

### Tool Organization

Tools are organized by feature domain:

```
mcp_server/
├── __init__.py
├── main.py              # Server entrypoint
├── config.py            # Configuration loader
├── dependencies.py      # DI setup (reuses api pattern)
└── tools/
    ├── __init__.py
    ├── base.py          # Base tool classes
    ├── registry.py      # Tool registration
    └── (feature modules in Phase 2+)
```

### Feature Domains

| Domain | Description | Phase |
|--------|-------------|-------|
| **portfolio** | Position and order management | Phase 2 |
| **screener** | Stock screening and analysis | Phase 2 |
| **strategy** | Trading strategy configuration | Phase 3 |
| **backtest** | Historical strategy testing | Phase 3 |
| **config** | System configuration management | Phase 3 |
| **social** | Social sentiment analysis | Phase 3 |
| **daily_review** | Combined workflow tools | Phase 4 |

## Development

### Adding New Tools (Future Phases)

1. Create tool class inheriting from `BaseTool`:

```python
from mcp_server.tools.base import BaseTool

class ListPositionsTool(BaseTool):
    @property
    def feature(self) -> str:
        return "portfolio"
    
    @property
    def name(self) -> str:
        return "list_positions"
    
    @property
    def description(self) -> str:
        return "List all trading positions"
    
    @property
    def input_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["open", "closed", "all"]}
            }
        }
    
    async def execute(self, arguments: dict) -> dict:
        # Use service layer
        service = get_portfolio_service()
        result = service.list_positions(status=arguments.get("status"))
        return result.model_dump()
```

2. Register tool in `tools/registry.py`:

```python
def create_registry(config: MCPConfig) -> ToolRegistry:
    registry = ToolRegistry(config)
    
    if config.is_feature_enabled('portfolio'):
        from mcp_server.tools.portfolio import get_portfolio_tools
        registry.register_tools(get_portfolio_tools())
    
    return registry
```

3. Add tool to `config/mcp_features.yaml`:

```yaml
features:
  portfolio:
    enabled: true
    tools:
      - list_positions  # New tool
```

### Configuration Validation

The configuration system validates:

- Valid log levels (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- At least one feature enabled in non-dev environments
- Reasonable rate limiting values (if enabled)

Validation warnings are logged but don't prevent server startup.

## API Compatibility

The MCP server is **completely separate from the FastAPI server**:

- No changes to existing FastAPI code
- Services are shared (read-only)
- Different protocol (MCP vs HTTP/REST)
- Can run alongside FastAPI server

## Next Steps

### Phase 2: Portfolio Tools (Week 2)

Implement first tool set:

- `list_positions`
- `get_position`
- `update_position_stop`
- `list_orders`
- `create_order`

### Phase 3: Screener & Strategy Tools (Week 3-4)

- Screener execution
- Universe management
- Strategy configuration

See full roadmap in project documentation.

## Troubleshooting

### Import Errors in Tests

If you see `ModuleNotFoundError: No module named 'mcp_server'`:

```bash
# Ensure package is installed in editable mode
pip install -e .

# Run tests with explicit PYTHONPATH
PYTHONPATH=. python -m pytest tests/mcp_server/ -v
```

### Configuration File Not Found

Default location: `config/mcp_features.yaml`

```bash
# Use custom path
python -m mcp_server.main --config /path/to/config.yaml
```

### Server Has No Tools

This is expected in Phase 1! The server validates configuration and infrastructure but doesn't register any tools yet. Tools will be added in Phase 2+.

## License

MIT
