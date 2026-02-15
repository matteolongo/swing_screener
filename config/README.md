# Configuration Directory

This directory contains configuration files for the Swing Screener application.

## Files

### `mcp_features.yaml`

Configuration file for the MCP (Model Context Protocol) server.

**Purpose:** Controls which features and tools are exposed through the MCP server interface.

**Structure:**
- `features`: Feature domains (config, strategy, screener, positions, orders, etc.)
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
  positions:
    enabled: true    # Enable positions feature
    tools:
      list:
        enabled: true
      close:
        enabled: false  # Disable close position tool
```

Changes require MCP server restart.

**Documentation:** See `docs/MCP_*.md` for complete documentation.

## Notes

- This directory is for **configuration files only**
- Do not store data or temporary files here
- Config files should be versioned (committed to git)
- Sensitive credentials should use environment variables, not config files

## Related Documentation

- [MCP Architecture](../docs/MCP_ARCHITECTURE.md) - Complete architecture design
- [MCP Feature Map](../docs/MCP_FEATURE_MAP.md) - All available features
- [MCP Usage Guide](../docs/MCP_USAGE_GUIDE.md) - How to use MCP server
- [MCP Implementation Roadmap](../docs/MCP_IMPLEMENTATION_ROADMAP.md) - Development plan
