# Swing Screener Agent

Automation layer that orchestrates Swing Screener workflows through the MCP server.

## Capabilities
- Daily screening and candidate review
- Order creation, fill, and cancellation
- Position review, stop suggestions, stop updates, and closes
- Daily review aggregation

## Dependencies
- MCP server running (stdio transport)
- MCP tools enabled in `config/mcp_features.yaml`

## CLI
Examples (see `python -m agent.cli --help` for full options):
- `python -m agent.cli screen --universe mega_all --top 10`
- `python -m agent.cli orders list --status pending`
- `python -m agent.cli positions review`
- `python -m agent.cli positions suggest-stops`
- `python -m agent.cli daily-review`

## Python API
Primary entry point: `SwingScreenerAgent`.
Common methods:
- `daily_screening(universe, top_n)`
- `review_positions()`
- `create_order_from_candidate(candidate)`
- `suggest_stop_updates()`
- `update_position_stop(position_id, new_stop)`
- `fill_order(order_id, fill_price, fill_date)`
- `close_position(position_id, exit_price, exit_date)`
- `daily_review(top_n, universe)`

## MCP Tool Coverage
The agent calls MCP tools exposed by `mcp_server` (see `mcp_server/README.md` for the tool list).
