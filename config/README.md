# Configuration Directory

This directory contains configuration files for the Swing Screener application.

## Files

### `defaults.yaml`

Low-level shared defaults for the system:
- runtime paths
- app config defaults
- strategy seed defaults
- intelligence defaults
- backend provider catalogs and operational fallback values

### `user.yaml`

Shared user-facing configuration that affects UI and system behavior without carrying secrets:
- `/api/config` compatibility payload under `app_config`
- API serving settings
- browser/app behavior defaults that are shared outside `localStorage`

### `strategies.yaml`

Authoritative strategy storage:
- `active_strategy_id`
- persisted strategy definitions

### `intelligence.yaml`

Dedicated intelligence configuration envelope:
- sanitized intelligence config
- bootstrap metadata
- last update timestamp

### `mcp.yaml`

MCP feature flags and server metadata.

Edit this file to enable or disable MCP features:

```yaml
features:
  portfolio:
    enabled: true
    tools:
      - list_positions
      - close_position
```

Changes require MCP server restart.

**Documentation:** See `mcp_server/docs/` for complete documentation.

## Notes

- New configurable behavior should be added to the existing YAML configuration surfaces in this directory instead of being hardcoded in Python, TypeScript, or prompts.
- Choose the config file that matches the scope of the setting:
  - `defaults.yaml` for shared system defaults
  - `user.yaml` for user-facing app and API behavior
  - `strategies.yaml` for strategy definitions and strategy-level tuning
  - `intelligence.yaml` for intelligence runtime settings and prompts
  - `mcp.yaml` for MCP feature flags and server metadata
- `docker-compose.yml` is the repo's local orchestration config. Use it for container/runtime wiring only, not for application defaults that belong in `config/*.yaml`.
- This directory is for **configuration files only**
- Do not store runtime artifacts or temporary files here
- Config files should be versioned (committed to git)
- Sensitive credentials should use environment variables, not config files

## Related Documentation

- [MCP Architecture](../mcp_server/docs/MCP_ARCHITECTURE.md) - Complete architecture design
- [MCP Feature Map](../mcp_server/docs/MCP_FEATURE_MAP.md) - All available features
- [MCP Usage Guide](../mcp_server/docs/MCP_USAGE_GUIDE.md) - How to use MCP server
- [MCP Implementation Roadmap](../mcp_server/docs/MCP_IMPLEMENTATION_ROADMAP.md) - Development plan
