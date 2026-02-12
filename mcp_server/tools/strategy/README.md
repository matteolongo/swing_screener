# Strategy Tools Module

This module provides MCP tools for managing and using trading strategies in the Swing Screener application.

## Overview

The strategy tools module exposes strategy management functionality through the Model Context Protocol, allowing external AI clients to:
- List all available trading strategies
- Retrieve details of specific strategies
- Get the currently active strategy
- Set a strategy as active for screening and trading

## Module Structure

```
strategy/
├── __init__.py                 # Package exports and get_strategy_tools() factory
├── _common.py                  # Shared utilities and logger
├── list_strategies.py          # Tool to list all strategies
├── get_strategy.py             # Tool to get a specific strategy
├── get_active_strategy.py      # Tool to get the active strategy
├── set_active_strategy.py      # Tool to set a strategy as active
└── README.md                   # This file
```

## Tools

### 1. ListStrategiesTool (`list_strategies`)

Lists all available trading strategies with their complete configurations.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

**Response Format:**
```json
{
  "strategies": [
    {
      "id": "strategy_id",
      "name": "Strategy Name",
      "description": "Strategy description",
      "is_default": false,
      "created_at": "2024-01-01T00:00:00",
      "updated_at": "2024-01-01T00:00:00",
      "universe": {...},
      "ranking": {...},
      "signals": {...},
      "risk": {...},
      "manage": {...},
      "backtest": {...},
      "social_overlay": {...}
    }
  ]
}
```

**Example Usage:**
```python
# Get all available strategies
strategies = await list_strategies_tool.execute({})
```

### 2. GetStrategyTool (`get_strategy`)

Retrieves the complete configuration of a specific strategy by its ID.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "strategy_id": {
      "type": "string",
      "description": "The unique identifier of the strategy to retrieve"
    }
  },
  "required": ["strategy_id"]
}
```

**Response Format:**
```json
{
  "strategy": {
    "id": "strategy_id",
    "name": "Strategy Name",
    "description": "Strategy description",
    "is_default": false,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00",
    "universe": {...},
    "ranking": {...},
    "signals": {...},
    "risk": {...},
    "manage": {...},
    "backtest": {...},
    "social_overlay": {...}
  }
}
```

**Error Response:**
```json
{
  "error": "Strategy not found: strategy_id"
}
```

**Validation:**
- `strategy_id` must be provided and non-empty
- `strategy_id` must be a string

**Example Usage:**
```python
# Get a specific strategy
strategy = await get_strategy_tool.execute({
  "strategy_id": "momentum_strategy"
})
```

### 3. GetActiveStrategyTool (`get_active_strategy`)

Retrieves the currently active strategy being used for screening and trading.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

**Response Format:**
```json
{
  "strategy": {
    "id": "active_strategy_id",
    "name": "Active Strategy Name",
    "description": "Strategy description",
    "is_default": false,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00",
    "universe": {...},
    "ranking": {...},
    "signals": {...},
    "risk": {...},
    "manage": {...},
    "backtest": {...},
    "social_overlay": {...}
  }
}
```

**Example Usage:**
```python
# Get the currently active strategy
active = await get_active_strategy_tool.execute({})
```

### 4. SetActiveStrategyTool (`set_active_strategy`)

Sets a specific strategy as active for use in screening and trading operations.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "strategy_id": {
      "type": "string",
      "description": "The unique identifier of the strategy to set as active"
    }
  },
  "required": ["strategy_id"]
}
```

**Response Format:**
```json
{
  "strategy": {
    "id": "strategy_id",
    "name": "Strategy Name",
    "description": "Strategy description",
    "is_default": false,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00",
    "universe": {...},
    "ranking": {...},
    "signals": {...},
    "risk": {...},
    "manage": {...},
    "backtest": {...},
    "social_overlay": {...}
  }
}
```

**Error Response:**
```json
{
  "error": "Strategy not found: strategy_id"
}
```

**Validation:**
- `strategy_id` must be provided and non-empty
- `strategy_id` must be a string
- Strategy must exist in the system

**Example Usage:**
```python
# Set a strategy as active
active = await set_active_strategy_tool.execute({
  "strategy_id": "momentum_strategy"
})
```

## Implementation Details

### Common Utilities (`_common.py`)

The `_common.py` module provides:

1. **Logger**: A configured logger for the strategy tools module
   ```python
   logger = logging.getLogger(__name__)
   ```

2. **get_strategy_service()**: A lazy-loading factory function that returns the strategy service instance
   ```python
   def get_strategy_service():
       """Lazy import to avoid loading FastAPI at module level."""
       from mcp_server.dependencies import get_strategy_service
       return get_strategy_service()
   ```

This approach allows the strategy tools to be imported without requiring the full FastAPI application context until a tool is actually executed.

### Tool Base Class Implementation

All strategy tools inherit from `BaseTool` and implement:

1. **feature property**: Always returns `"strategy"`
2. **name property**: Returns the tool's unique name
3. **description property**: Returns a human-readable description
4. **input_schema property**: Returns JSON schema for input validation
5. **execute() method**: Async method that performs the actual work

### Error Handling

All tools follow a consistent error handling pattern:

```python
try:
    # Perform operation
    result = service.method()
    return {"result": result}
except Exception as e:
    logger.error(f"Error description: {e}")
    return {"error": str(e)}
```

### Input Validation

Tools validate input parameters before calling the service:
- Check for required parameters
- Validate parameter types
- Trim whitespace from string inputs
- Return descriptive error messages for validation failures

## Integration with Registry

The tools are registered in the MCP tool registry through the `get_strategy_tools()` factory function in `__init__.py`.

The registry is configured in `config/mcp_features.yaml`:

```yaml
features:
  strategy:
    enabled: true
    tools:
      - list_strategies
      - get_strategy
      - get_active_strategy
      - set_active_strategy
```

## Service Layer Reference

These tools wrap the `StrategyService` methods from `api/services/strategy_service.py`:

- `list_strategies()` → `ListStrategiesTool`
- `get_strategy(strategy_id: str)` → `GetStrategyTool`
- `get_active_strategy()` → `GetActiveStrategyTool`
- `set_active_strategy(request: ActiveStrategyRequest)` → `SetActiveStrategyTool`

## Model Reference

Strategy configuration follows the `Strategy` model defined in `api/models/strategy.py`:

- **id**: Unique strategy identifier
- **name**: Human-readable strategy name
- **description**: Optional description
- **module**: Strategy module (e.g., "momentum")
- **is_default**: Whether this is the default strategy
- **created_at**: ISO timestamp of creation
- **updated_at**: ISO timestamp of last update
- **universe**: Universe configuration (trend, vol, mom, filt)
- **ranking**: Ranking configuration (weights and top_n)
- **signals**: Signal configuration (breakout, pullback, history)
- **risk**: Risk management configuration (account size, position sizing, regime)
- **manage**: Position management configuration (breakeven, trailing stop)
- **backtest**: Backtest configuration (entry, exit, profit, holding)
- **social_overlay**: Social sentiment overlay configuration

## Testing

The module includes comprehensive input validation that can be tested:

```python
# Test missing required parameter
result = await get_strategy_tool.execute({})
# Returns: {"error": "Missing required parameter: strategy_id"}

# Test invalid parameter type
result = await get_strategy_tool.execute({"strategy_id": 123})
# Returns: {"error": "strategy_id must be a non-empty string"}

# Test empty string
result = await set_active_strategy_tool.execute({"strategy_id": "   "})
# Returns: {"error": "strategy_id must be a non-empty string"}
```

## Usage Examples

### List all strategies
```python
from mcp_server.tools.strategy import ListStrategiesTool
tool = ListStrategiesTool()
result = await tool.execute({})
strategies = result.get("strategies", [])
```

### Get a specific strategy
```python
from mcp_server.tools.strategy import GetStrategyTool
tool = GetStrategyTool()
result = await tool.execute({"strategy_id": "momentum"})
strategy = result.get("strategy") or result.get("error")
```

### Get and set active strategy
```python
from mcp_server.tools.strategy import GetActiveStrategyTool, SetActiveStrategyTool

get_active = GetActiveStrategyTool()
current = await get_active.execute({})
print(f"Current: {current['strategy']['id']}")

set_active = SetActiveStrategyTool()
result = await set_active.execute({"strategy_id": "new_strategy"})
print(f"Activated: {result['strategy']['id']}")
```

### Get all tools
```python
from mcp_server.tools.strategy import get_strategy_tools

tools = get_strategy_tools()
for tool in tools:
    print(f"Tool: {tool.name} - {tool.description}")
```

## Dependencies

- **FastAPI**: For service layer dependency injection (lazy-loaded)
- **Pydantic**: For model validation
- **api.services.strategy_service**: StrategyService for business logic
- **api.models.strategy**: Strategy model and request models

## Logging

The module uses Python's standard logging configured at INFO level by default. Logger output is directed to the MCP server logs with the module name `mcp_server.tools.strategy`.

Log entries include:
- Tool execution start/end
- Input validation errors
- Service layer errors
- Exception details

## Future Enhancements

Potential future additions to the strategy tools module:
1. Tool to create new strategies
2. Tool to update existing strategies
3. Tool to delete strategies (with safeguards)
4. Tool to export/import strategies
5. Tool to validate strategy configurations
6. Tool to compare strategies
7. Tool to copy/clone strategies
8. Batch operations for multiple strategies
