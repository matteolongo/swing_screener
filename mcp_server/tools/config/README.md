# Config Tools Module Documentation

## Overview

The config tools module provides MCP (Model Context Protocol) tools for managing application configuration in the swing_screener system. It exposes two main operations:

1. **get_config**: Retrieve current application configuration
2. **update_config**: Update application configuration

## Architecture

### File Structure

```
mcp_server/tools/config/
├── __init__.py          # Package exports and get_config_tools() function
├── _common.py           # Common utilities and lazy imports
├── get_config.py        # GetConfigTool class
└── update_config.py     # UpdateConfigTool class
```

### Dependencies

- **API Layer**: Uses `api.routers.config` module's global state for config storage
- **Models**: Uses `api.models.config` for AppConfig, RiskConfig, IndicatorConfig, ManageConfig
- **MCP Framework**: Extends `mcp_server.tools.base.BaseTool`

## Tools

### GetConfigTool

**Purpose**: Retrieve the current application configuration

**Properties**:
- `name`: "get_config"
- `feature`: "config"
- `input_schema`: Empty object (no parameters required)

**Input**: None

**Output**: 
```json
{
  "risk": {
    "account_size": 50000,
    "risk_pct": 0.01,
    "max_position_pct": 0.6,
    "min_shares": 1,
    "k_atr": 2.0,
    "min_rr": 2.0,
    "max_fee_risk_pct": 0.2
  },
  "indicators": {
    "sma_fast": 20,
    "sma_mid": 50,
    "sma_long": 200,
    "atr_window": 14,
    "lookback_6m": 126,
    "lookback_12m": 252,
    "benchmark": "SPY",
    "breakout_lookback": 50,
    "pullback_ma": 20,
    "min_history": 260
  },
  "manage": {
    "breakeven_at_r": 1.0,
    "trail_after_r": 2.0,
    "trail_sma": 20,
    "sma_buffer_pct": 0.005,
    "max_holding_days": 20
  },
  "positions_file": "data/positions.json",
  "orders_file": "data/orders.json"
}
```

### UpdateConfigTool

**Purpose**: Update application configuration with partial or full updates

**Properties**:
- `name`: "update_config"
- `feature`: "config"
- `input_schema`: Complete schema with nested objects

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "risk": {
      "type": "object",
      "properties": {
        "account_size": {"type": "number"},
        "risk_pct": {"type": "number"},
        "max_position_pct": {"type": "number"},
        "min_shares": {"type": "integer"},
        "k_atr": {"type": "number"},
        "min_rr": {"type": "number"},
        "max_fee_risk_pct": {"type": "number"}
      }
    },
    "indicators": {
      "type": "object",
      "properties": {
        "sma_fast": {"type": "integer"},
        "sma_mid": {"type": "integer"},
        "sma_long": {"type": "integer"},
        "atr_window": {"type": "integer"},
        "lookback_6m": {"type": "integer"},
        "lookback_12m": {"type": "integer"},
        "benchmark": {"type": "string"},
        "breakout_lookback": {"type": "integer"},
        "pullback_ma": {"type": "integer"},
        "min_history": {"type": "integer"}
      }
    },
    "manage": {
      "type": "object",
      "properties": {
        "breakeven_at_r": {"type": "number"},
        "trail_after_r": {"type": "number"},
        "trail_sma": {"type": "integer"},
        "sma_buffer_pct": {"type": "number"},
        "max_holding_days": {"type": "integer"}
      }
    },
    "positions_file": {"type": "string"},
    "orders_file": {"type": "string"}
  }
}
```

**Example Update**:
```json
{
  "risk": {
    "account_size": 75000,
    "risk_pct": 0.02
  },
  "indicators": {
    "sma_fast": 25
  }
}
```

**Output**: Updated configuration (same structure as GetConfigTool output)

## Implementation Details

### Lazy Imports

The `_common.py` module uses lazy imports to avoid loading FastAPI at module import time:

```python
def get_config_from_router():
    from api.routers.config import current_config
    return current_config
```

This allows the MCP server to import these tools without requiring the FastAPI server to be running.

### Deep Merging

UpdateConfigTool performs deep merges to support partial updates:

1. Gets current config from router
2. Converts to dictionary with `.model_dump()`
3. Merges updates into dictionary
4. Creates new AppConfig from merged dictionary
5. Validates with Pydantic
6. Sets updated config in router

### Error Handling

All tools implement comprehensive error handling:

- Try-except blocks catch and log exceptions
- Errors are returned as JSON with "error" key
- Logging includes context about the operation

## Integration

### Registry Registration

Config tools are registered in `mcp_server/tools/registry.py`:

```python
if config.is_feature_enabled('config'):
    from mcp_server.tools.config import get_config_tools
    registry.register_tools(get_config_tools())
```

### Feature Configuration

The config feature is defined in `config/mcp_features.yaml`:

```yaml
features:
  config:
    enabled: true
    tools:
      - get_config
      - update_config
```

## Usage Examples

### Get Current Configuration

```python
from mcp_server.tools.config import GetConfigTool

tool = GetConfigTool()
config = await tool.execute({})
print(config['risk']['account_size'])  # 50000
```

### Update Configuration

```python
from mcp_server.tools.config import UpdateConfigTool

tool = UpdateConfigTool()
result = await tool.execute({
    'risk': {
        'account_size': 100000
    }
})
print(result['risk']['account_size'])  # 100000
```

## API Integration

The tools work seamlessly with the existing FastAPI endpoints:

- `GET /api/config` - Retrieve configuration
- `PUT /api/config` - Update configuration
- `POST /api/config/reset` - Reset to defaults
- `GET /api/config/defaults` - Get default configuration

The MCP tools provide the same functionality through the MCP protocol.

## Type Safety

All code includes full type hints and uses:

```python
from __future__ import annotations
```

This enables modern type hinting practices while maintaining Python 3.8+ compatibility.

## Testing

The implementation has been validated with:

- ✓ File structure verification
- ✓ Class inheritance checks
- ✓ Import/export validation
- ✓ Schema validation
- ✓ Registry integration
- ✓ Async method validation
- ✓ Error handling verification
- ✓ Security analysis (CodeQL)

## Security

The implementation passes CodeQL security analysis with no alerts. Key security considerations:

- Lazy imports prevent unnecessary dependencies
- Pydantic validation ensures type safety
- Error messages don't expose system paths
- Deep copying prevents mutation of shared state
