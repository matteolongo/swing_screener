# MCP Server - Swing Screener

Model Context Protocol (MCP) server that exposes Swing Screener functionality as tools for AI clients.

## Run
```bash
python -m mcp_server.main
```
Options:
- `--validate-only`
- `--config /path/to/config.yaml` (defaults to `config/mcp_features.yaml`)

## Tool Catalog
Portfolio:
- `list_positions`
- `get_position`
- `update_position_stop`
- `suggest_position_stop`
- `close_position`
- `list_orders`
- `create_order`
- `fill_order`
- `cancel_order`

Screener:
- `list_universes`
- `run_screener`
- `preview_order`

Strategy:
- `list_strategies`
- `get_strategy`
- `get_active_strategy`
- `set_active_strategy`

Config:
- `get_config`
- `update_config`

Daily Review:
- `get_daily_review`
- `get_candidate_recommendations`

Social:
- `get_social_sentiment`
- `analyze_ticker_sentiment`

Not implemented as MCP tools:
- Backtest
- Intelligence

## Architecture Notes
- Tools reuse services in `api/services/`.
- Feature toggles live in `config/mcp_features.yaml`.

## Related Docs
- `mcp_server/docs/` (archived snapshots)
- `docs/overview/INDEX.md`
