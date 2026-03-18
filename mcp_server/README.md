# MCP Server - Swing Screener

Model Context Protocol (MCP) server that exposes Swing Screener functionality as tools for AI clients. This is the canonical transport for the `agent/` package.

## Run
```bash
python -m mcp_server.main
```
Options:
- `--validate-only`
- `--config /path/to/config.yaml` (defaults to `config/mcp.yaml`)

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

Intelligence:
- `get_workspace_context`
- `get_intelligence_opportunities`
- `get_intelligence_events`
- `chat_answer`

## Architecture Notes
- Tools reuse shared services in `api/services/`.
- Feature toggles live in `config/mcp.yaml`.
- The agent launches this server over stdio and discovers tools from the live registry instead of a hardcoded adapter table.
- MCP tool schemas are canonical now. Legacy aliases such as `top_n`, `strategy`, `fill_price`, `fill_date`, and `new_stop_price` are not accepted.

## Canonical Tool Arguments
- `run_screener`: `universe`, `top`, `strategy_id`, optional filters
- `preview_order`: `ticker`, `entry_price`, `stop_price`, optional risk inputs
- `fill_order`: `order_id`, `filled_price`, `filled_date`, optional `stop_price`
- `update_position_stop`: `position_id`, `new_stop`, optional `reason`

## Related Docs
- `docs/overview/INDEX.md`
