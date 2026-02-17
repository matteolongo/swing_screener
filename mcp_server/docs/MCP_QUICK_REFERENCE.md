# MCP Quick Reference

> **Status: Current snapshot.**  
> **Last Reviewed:** February 17, 2026.

**Quick reference for Swing Screener MCP server integration**

---

## What is MCP?

**Model Context Protocol (MCP)** enables AI assistants to interact with external tools and data sources.

**For Swing Screener:** Provides AI-assisted trading through natural language interface.

---

## Architecture (One Minute)

```
┌─────────────────────────────────────────────┐
│         User Interfaces (Choose One)        │
├──────────────────┬──────────────────────────┤
│  FastAPI + Web   │      MCP Server          │
│   (Port 8000)    │      (Port 8001)         │
└────────┬─────────┴──────────┬───────────────┘
         │                    │
         └─────────┬──────────┘
                   ▼
         ┌─────────────────────┐
         │  Shared Services    │
         │  (Business Logic)   │
         └─────────┬───────────┘
                   ▼
         ┌─────────────────────┐
         │   Repositories      │
         └─────────┬───────────┘
                   ▼
         ┌─────────────────────┐
         │   JSON Files        │
         └─────────────────────┘
```

**Key:** Both interfaces share the same business logic (services).

---

## Documents Overview

| Document | Purpose | Size |
|----------|---------|------|
| [MCP_SUMMARY.md](MCP_SUMMARY.md) | Executive summary | Historical |
| [MCP_FEATURE_MAP.md](MCP_FEATURE_MAP.md) | Feature inventory | Historical |
| [MCP_ARCHITECTURE.md](MCP_ARCHITECTURE.md) | Design snapshot | Historical |
| [MCP_IMPLEMENTATION_ROADMAP.md](MCP_IMPLEMENTATION_ROADMAP.md) | Planning roadmap | Historical |
| [MCP_USAGE_GUIDE.md](MCP_USAGE_GUIDE.md) | Planning guide | Historical |
| [config/mcp_features.yaml](/config/mcp_features.yaml) | Configuration | Current |

**Total:** ~3,900 lines of documentation

---

## Features at a Glance

### 6 Active Domains (22 tools)

1. **Portfolio** - Positions + orders (9 tools)
2. **Screener** - Screening + sizing (3 tools)
3. **Strategy** - Strategy management (4 tools)
4. **Config** - App configuration (2 tools)
5. **Daily Review** - Consolidated workflow (2 tools)
6. **Social** - Sentiment analysis (2 tools)

**Not implemented in MCP tools:** backtest, intelligence

---

## Tool Names (Current)

**Portfolio**
- `list_positions`, `get_position`, `update_position_stop`
- `list_orders`, `create_order`, `fill_order`, `cancel_order`
- `suggest_position_stop`, `close_position`

**Screener**
- `run_screener`, `list_universes`, `preview_order`

**Strategy**
- `list_strategies`, `get_strategy`, `get_active_strategy`, `set_active_strategy`

**Config**
- `get_config`, `update_config`

**Daily Review**
- `get_daily_review`, `get_candidate_recommendations`

**Social**
- `get_social_sentiment`, `analyze_ticker_sentiment`

---

## Key Finding

**✅ Service layer is already perfect for MCP!**

- No HTTP coupling
- Already using dependency injection
- Stateless and testable
- **Zero refactor needed**

---

## Quick Start

### Start MCP Server

```bash
cd /path/to/swing_screener
python -m mcp_server.main
```

### Use from Python

```python
from mcp import Client

client = Client("http://localhost:8001")

# List positions
positions = client.call_tool("list_positions", {"status": "open"})

# Run screener
candidates = client.call_tool("run_screener", {"top": 10})

# Create order
order = client.call_tool("create_order", {
    "ticker": "AAPL",
    "order_type": "BUY_LIMIT",
    "quantity": 100,
    "limit_price": 150.0,
    "stop_price": 145.0
})
```

---

## Configuration Example

Edit `config/mcp_features.yaml`:

```yaml
features:
  portfolio:
    enabled: true
    tools:
      - list_positions
      - close_position
  
```

---

## Testing Strategy

### 3 Levels

1. **Unit Tests** - Tool classes in isolation
2. **Integration Tests** - Full MCP → service → storage
3. **Parity Tests** - Compare FastAPI vs MCP responses

**Target:** 80%+ code coverage

---

## Notes

- MCP tools are a subset of API capabilities.
- Backtest and intelligence exist in the API/UI but not as MCP tools yet.

---

## Support

- **Full Documentation:** See documents listed above
- **Issues:** GitHub Issues
- **Questions:** See MCP_USAGE_GUIDE.md troubleshooting section

---

**Status:** Current snapshot (implemented)  
**Date:** February 17, 2026
