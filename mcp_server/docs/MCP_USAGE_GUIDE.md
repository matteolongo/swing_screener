# MCP Server Usage Guide

> **Status: Archived (pre-implementation planning).** The MCP server has since been implemented; tool names and configuration may differ. Use `mcp_server/docs/MCP_QUICK_REFERENCE.md`, `mcp_server/docs/MCP_SERVER_COMPLETE.md`, and `mcp_server/README.md` for current usage.  
> **Last Reviewed:** February 17, 2026.
> **Note:** Examples in this document use pre-implementation tool names (e.g., `positions_list`). Current tools use names like `list_positions` and `run_screener`.

**Purpose:** Guide for using the Swing Screener MCP server  
**Audience:** AI assistants, developers, power users  
**Date:** February 12, 2026  
**Status:** Archived (Pre-Implementation Snapshot)

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Configuration](#configuration)
5. [Using Tools](#using-tools)
6. [Common Workflows](#common-workflows)
7. [Error Handling](#error-handling)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Swing Screener MCP server provides AI assistants (like Claude, GitHub Copilot) with programmatic access to trading operations through the Model Context Protocol (MCP).

### What You Can Do

- **Read Operations:** Query positions, orders, strategies, config
- **Write Operations:** Create orders, update stops, modify strategies
- **Complex Operations:** Run screener, execute backtests, get daily review
- **Configuration:** Manage application settings

### Interfaces Comparison

| Feature | FastAPI + Web UI | MCP Server |
|---------|------------------|------------|
| **Access** | HTTP REST + Browser | MCP Protocol |
| **Use Case** | Manual trading | AI-assisted trading |
| **Authentication** | None (localhost) | None (localhost) |
| **Data Format** | JSON | JSON (via MCP) |
| **Business Logic** | Shared services | Shared services |

**Key Point:** Both interfaces use the **same underlying service layer**, so data is always consistent.

---

## Installation

### Prerequisites

- Python 3.10+
- Swing Screener installed
- Existing FastAPI server (optional but recommended)

### Install MCP Dependencies

```bash
cd /path/to/swing_screener
pip install -e ".[mcp]"
```

This installs:
- `mcp>=1.0.0` - MCP SDK
- `pyyaml>=6.0` - Configuration files

### Verify Installation

```bash
python -m mcp_server.main --help
```

You should see:
```
usage: main.py [-h] [--config CONFIG] [--port PORT] [--host HOST]

Swing Screener MCP Server

optional arguments:
  -h, --help       show this help message and exit
  --config CONFIG  Path to feature configuration file (default: config/mcp_features.yaml)
  --port PORT      Port to run server on (default: 8001)
  --host HOST      Host to bind to (default: 0.0.0.0)
```

---

## Quick Start

### 1. Start the MCP Server

```bash
# Terminal 1: Start MCP server
cd /path/to/swing_screener
python -m mcp_server.main
```

You should see:
```
INFO [mcp_server] Starting Swing Screener MCP server...
INFO [mcp_server] Configuration: config/mcp_features.yaml
INFO [mcp_server] Registered 25 tools
INFO [mcp_server] Server running on http://0.0.0.0:8001
```

### 2. (Optional) Start FastAPI Server

The FastAPI server is independent but can run simultaneously:

```bash
# Terminal 2: Start FastAPI server (optional)
cd /path/to/swing_screener
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Connect an MCP Client

```python
from mcp import Client

# Connect to MCP server
client = Client("http://localhost:8001")

# List available tools
tools = client.list_tools()
print(f"Available tools: {len(tools)}")

# Call a tool
result = client.call_tool("config_get", {})
print(result)
```

---

## Configuration

### Feature Configuration File

**Location:** `config/mcp_features.yaml`

This file controls which features and tools are exposed through the MCP server.

### Enable/Disable Features

```yaml
features:
  positions:
    enabled: true  # Enable entire feature
    tools:
      list:
        enabled: true  # Enable specific tool
      close:
        enabled: false  # Disable specific tool
```

### Security Settings

```yaml
security:
  # Require confirmation for dangerous operations
  require_confirmation:
    - config_reset
    - positions_close
    - orders_fill
  
  # Disable all write operations
  read_only_mode: false
```

### Timeout Configuration

```yaml
features:
  screener:
    tools:
      run:
        enabled: true
        timeout_seconds: 300  # 5 minutes for screener
```

### Reload Configuration

**Changes require server restart:**

```bash
# Ctrl+C to stop server
# Edit config/mcp_features.yaml
# Restart server
python -m mcp_server.main
```

---

## Using Tools

### Tool Naming Convention

Format: `<domain>_<operation>`

Examples:
- `config_get` - Get configuration
- `strategy_list` - List strategies
- `positions_list` - List positions
- `orders_create` - Create order

### Tool Categories

**1. Simple Read Tools**
```python
# Get current config
result = client.call_tool("config_get", {})

# List strategies
result = client.call_tool("strategy_list", {})

# Get positions
result = client.call_tool("positions_list", {"status": "open"})
```

**2. Simple Write Tools**
```python
# Update config
result = client.call_tool("config_update", {
    "config": {
        "risk": {"max_risk_per_trade": 0.02}
    }
})

# Set active strategy
result = client.call_tool("strategy_set_active", {
    "strategy_id": "my-strategy"
})
```

**3. Complex Tools (Long-Running)**
```python
# Run screener (may take 5+ minutes)
result = client.call_tool("screener_run", {
    "top_n": 10,
    "universe": "sp500"
})

# Full backtest (may take 10+ minutes)
result = client.call_tool("backtest_full", {
    "start_date": "2020-01-01",
    "end_date": "2023-12-31"
})
```

### Tool Input Schemas

Each tool has a defined input schema. Get it with:

```python
schema = client.get_tool_schema("positions_list")
print(schema)
```

Output:
```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": ["open", "closed"],
      "description": "Filter by position status"
    }
  }
}
```

---

## Common Workflows

### Workflow 1: Check Positions & Orders

```python
from mcp import Client

client = Client("http://localhost:8001")

# 1. Get open positions
positions = client.call_tool("positions_list", {"status": "open"})
print(f"Open positions: {len(positions['data']['positions'])}")

for pos in positions['data']['positions']:
    print(f"  {pos['ticker']}: {pos['quantity']} @ {pos['entry_price']}")

# 2. Get pending orders
orders = client.call_tool("orders_list", {"status": "pending"})
print(f"Pending orders: {len(orders['data']['orders'])}")

for order in orders['data']['orders']:
    print(f"  {order['ticker']}: {order['order_type']} @ {order['limit_price']}")
```

### Workflow 2: Run Screener & Create Order

```python
# 1. Run screener
candidates = client.call_tool("screener_run", {
    "top_n": 10,
    "universe": "sp500"
})

print(f"Found {len(candidates['data']['candidates'])} candidates")
top = candidates['data']['candidates'][0]
print(f"Top pick: {top['ticker']} (score: {top['total_score']})")

# 2. Preview order for top candidate
preview = client.call_tool("screener_preview_order", {
    "ticker": top['ticker'],
    "entry_price": top['suggested_entry'],
    "stop_price": top['suggested_stop']
})

print(f"Position size: {preview['data']['quantity']} shares")
print(f"Risk: ${preview['data']['risk_dollars']} ({preview['data']['risk_pct']}%)")

# 3. Create order if risk is acceptable
if preview['data']['is_recommended']:
    order = client.call_tool("orders_create", {
        "ticker": top['ticker'],
        "order_type": "BUY_LIMIT",
        "quantity": preview['data']['quantity'],
        "limit_price": top['suggested_entry'],
        "stop_price": top['suggested_stop']
    })
    print(f"Order created: {order['data']['order_id']}")
else:
    print("Not recommended - risk too high")
```

### Workflow 3: Update Position Stops

```python
# 1. Get positions needing stop updates
positions = client.call_tool("positions_list", {"status": "open"})

for pos in positions['data']['positions']:
    # 2. Get suggested stop
    suggestion = client.call_tool("positions_get_stop_suggestion", {
        "position_id": pos['position_id']
    })
    
    suggested_stop = suggestion['data']['suggested_stop']
    current_stop = pos['stop_price']
    
    # 3. Update if suggestion is better (higher)
    if suggested_stop > current_stop:
        print(f"Updating {pos['ticker']} stop: {current_stop} -> {suggested_stop}")
        
        result = client.call_tool("positions_update_stop", {
            "position_id": pos['position_id'],
            "new_stop": suggested_stop
        })
        
        if result['success']:
            print(f"  ✓ Updated (reason: {result['data']['reason']})")
    else:
        print(f"Keeping {pos['ticker']} stop at {current_stop}")
```

### Workflow 4: Daily Review

```python
# Get comprehensive daily review
review = client.call_tool("daily_review_get", {"top_n": 10})

# Review positions
positions = review['data']['positions']
print(f"\nPositions Summary:")
print(f"  Trailing: {len(positions['trailing'])}")
print(f"  At breakeven: {len(positions['at_breakeven'])}")
print(f"  Below breakeven: {len(positions['below_breakeven'])}")
print(f"  Holding too long: {len(positions['holding_too_long'])}")

# Review candidates
candidates = review['data']['candidates']
print(f"\nTop {len(candidates)} candidates:")
for c in candidates[:5]:
    print(f"  {c['ticker']}: {c['total_score']:.2f}")
```

### Workflow 5: Backtest Strategy

```python
# 1. Run quick backtest (recent history)
quick = client.call_tool("backtest_quick", {})

print(f"Quick backtest results:")
print(f"  Total trades: {quick['data']['total_trades']}")
print(f"  Win rate: {quick['data']['win_rate']}%")
print(f"  Avg R: {quick['data']['avg_r']}")

# 2. Run full backtest for detailed analysis
full = client.call_tool("backtest_full", {
    "start_date": "2020-01-01",
    "end_date": "2023-12-31"
})

sim_id = full['data']['simulation_id']
print(f"Full backtest saved as: {sim_id}")

# 3. Get detailed results
details = client.call_tool("backtest_get_simulation", {
    "simulation_id": sim_id
})

print(f"Performance metrics:")
print(f"  Sharpe ratio: {details['data']['sharpe_ratio']}")
print(f"  Max drawdown: {details['data']['max_drawdown']}")
```

---

## Error Handling

### Tool Result Format

All tools return a standardized result:

```python
{
  "success": True,     # or False
  "data": {...},       # Result data (if success)
  "error": "message"   # Error message (if not success)
}
```

### Handling Errors

```python
result = client.call_tool("positions_get", {"position_id": "unknown-id"})

if not result['success']:
    print(f"Error: {result['error']}")
else:
    print(f"Position: {result['data']}")
```

### Common Errors

**1. Not Found**
```python
{"success": False, "error": "Not found: Position 'unknown-id' not found"}
```

**2. Validation Error**
```python
{"success": False, "error": "Invalid: quantity must be positive"}
```

**3. Confirmation Required**
```python
{
  "success": False,
  "error": "Confirmation required. Add 'confirmed: true' to proceed."
}
```

Fix:
```python
result = client.call_tool("positions_close", {
    "position_id": "pos-123",
    "confirmed": True  # Add confirmation
})
```

**4. Read-Only Mode**
```python
{"success": False, "error": "Server is in read-only mode"}
```

**5. Timeout**
```python
{"success": False, "error": "Operation timed out after 300 seconds"}
```

### Retry Pattern

```python
from time import sleep

def call_tool_with_retry(client, tool_name, params, max_retries=3):
    for attempt in range(max_retries):
        result = client.call_tool(tool_name, params)
        if result['success']:
            return result
        
        if "timeout" in result['error'].lower():
            print(f"Timeout, retrying... (attempt {attempt+1})")
            sleep(5)
        else:
            break  # Don't retry non-timeout errors
    
    return result
```

---

## Troubleshooting

### Server Won't Start

**Error:** `ModuleNotFoundError: No module named 'mcp'`  
**Fix:** Install MCP dependencies:
```bash
pip install -e ".[mcp]"
```

**Error:** `FileNotFoundError: config/mcp_features.yaml`  
**Fix:** Ensure you're in the right directory:
```bash
cd /path/to/swing_screener
python -m mcp_server.main
```

**Error:** `Address already in use`  
**Fix:** Change port:
```bash
python -m mcp_server.main --port 8002
```

### Tool Not Available

**Error:** Tool `backtest_run` not found  
**Fix:** Check configuration:
```bash
grep -A5 "backtest:" config/mcp_features.yaml
```

Ensure `enabled: true` for the feature and tool.

### Tool Timeouts

**Error:** "Operation timed out after 300 seconds"  
**Fix:** Increase timeout in config:
```yaml
features:
  screener:
    tools:
      run:
        timeout_seconds: 600  # Increase from 300 to 600
```

### Slow Performance

**Symptom:** Tools taking longer than expected

**Checks:**
1. Is FastAPI server also running? (Both are fine, no conflict)
2. Is market data provider slow? (yfinance can be slow)
3. Large universe? (SP500 takes longer than small universe)

**Solutions:**
1. Use smaller universe for testing
2. Use cached market data if available
3. Run during off-peak hours

### File Lock Errors

**Error:** "Could not acquire file lock"

**Cause:** Both FastAPI and MCP trying to write simultaneously

**Fix:** File locking handles this automatically. If you see this error repeatedly:
1. Check no processes are holding files open
2. Restart both servers
3. Check file permissions

### Data Inconsistency

**Symptom:** MCP and FastAPI return different data

**Investigation:**
1. Both use same JSON files - check file timestamps
2. Ensure both services use same dependency injection
3. Check if one service cached stale data

**This should not happen** - if it does, it's a bug. Report it.

---

## Advanced Usage

### Environment Variables

Configure via environment:
```bash
export MCP_CONFIG_PATH=/custom/path/mcp_features.yaml
export MCP_PORT=8002
export MCP_LOG_LEVEL=DEBUG

python -m mcp_server.main
```

### Logging

View detailed logs:
```yaml
# config/mcp_features.yaml
logging:
  level: "DEBUG"
  log_tool_calls: true
  log_tool_inputs: true   # Careful: may log sensitive data
  log_tool_outputs: true  # Careful: verbose
```

### Read-Only Mode

Safe for testing/demos:
```yaml
security:
  read_only_mode: true
```

All write operations will fail with clear error message.

### Custom Timeouts

Per-tool timeout:
```yaml
features:
  backtest:
    tools:
      full:
        timeout_seconds: 1200  # 20 minutes for large backtest
```

---

## Best Practices

### 1. Check Before Writing

```python
# Good: Preview before creating order
preview = client.call_tool("screener_preview_order", {...})
if preview['data']['is_recommended']:
    client.call_tool("orders_create", {...})

# Bad: Create order without validation
client.call_tool("orders_create", {...})  # May fail risk checks
```

### 2. Handle Errors Gracefully

```python
# Good: Check result
result = client.call_tool("positions_get", {"position_id": pos_id})
if result['success']:
    process(result['data'])
else:
    log_error(result['error'])

# Bad: Assume success
data = client.call_tool("positions_get", {"position_id": pos_id})['data']  # May crash
```

### 3. Use Appropriate Timeouts

```python
# Long operation: be patient
result = client.call_tool("screener_run", {}, timeout=600)

# Quick operation: fail fast
result = client.call_tool("config_get", {}, timeout=5)
```

### 4. Respect Confirmations

Don't auto-confirm dangerous operations without user input:
```python
# Good: Ask user
if user_confirms("Close position?"):
    client.call_tool("positions_close", {..., "confirmed": True})

# Bad: Auto-confirm everything
client.call_tool("positions_close", {..., "confirmed": True})  # Dangerous!
```

---

## Next Steps

1. **Try Examples:** Run the example workflows above
2. **Read Architecture:** See `mcp_server/docs/MCP_ARCHITECTURE.md` for design details
3. **Customize Config:** Edit `config/mcp_features.yaml` for your needs
4. **Build Integrations:** Use MCP tools in your AI assistant workflows
5. **Report Issues:** File bugs or feature requests on GitHub

---

## Support

- **Documentation:** `mcp_server/docs/` files
- **Issues:** GitHub Issues
- **Architecture:** See `mcp_server/docs/MCP_ARCHITECTURE.md`
- **Implementation:** See `mcp_server/docs/MCP_IMPLEMENTATION_ROADMAP.md`

---

**Document Status:** Archived (Planning Phase Snapshot)  
**Last Updated:** February 12, 2026  
**Next Review:** Not scheduled (superseded by implementation docs)
