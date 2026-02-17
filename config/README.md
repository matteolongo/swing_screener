# Configuration Directory

This directory contains configuration files for the Swing Screener application.

## Files

### `mcp_features.yaml`

Configuration file for the MCP (Model Context Protocol) server.

**Purpose:** Controls which features and tools are exposed through the MCP server interface.

**Structure:**
- `features`: Feature domains (portfolio, strategy, screener, config, daily_review, social)
  - Backtest is listed in the sample config but is **not implemented** in MCP tools yet
  - Each feature has tools that can be individually enabled/disabled
  - Per-tool settings: timeout, confirmation requirements
- `security`: Security settings
  - Confirmation requirements for dangerous operations
  - Read-only mode toggle
- `execution`: Execution settings
  - Default/max timeouts
  - Concurrency limits
- `logging`: Logging configuration

**Usage:**

Edit this file to enable/disable MCP features:

```yaml
features:
  portfolio:
    enabled: true    # Enable portfolio feature
    tools:
      - list_positions
      - close_position
```

Changes require MCP server restart.

**Documentation:** See `mcp_server/docs/` for complete documentation.

## Notes

- This directory is for **configuration files only**
- Do not store data or temporary files here
- Config files should be versioned (committed to git)
- Sensitive credentials should use environment variables, not config files

## Related Documentation

- [MCP Architecture](../mcp_server/docs/MCP_ARCHITECTURE.md) - Complete architecture design
- [MCP Feature Map](../mcp_server/docs/MCP_FEATURE_MAP.md) - All available features
- [MCP Usage Guide](../mcp_server/docs/MCP_USAGE_GUIDE.md) - How to use MCP server
- [MCP Implementation Roadmap](../mcp_server/docs/MCP_IMPLEMENTATION_ROADMAP.md) - Development plan
