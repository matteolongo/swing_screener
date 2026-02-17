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
| [MCP_SUMMARY.md](MCP_SUMMARY.md) | Executive summary | 545 lines |
| [MCP_FEATURE_MAP.md](MCP_FEATURE_MAP.md) | Complete feature inventory | 525 lines |
| [MCP_ARCHITECTURE.md](MCP_ARCHITECTURE.md) | Detailed design | 988 lines |
| [MCP_IMPLEMENTATION_ROADMAP.md](MCP_IMPLEMENTATION_ROADMAP.md) | 6-week plan | 780 lines |
| [MCP_USAGE_GUIDE.md](MCP_USAGE_GUIDE.md) | User guide | 708 lines |
| [config/mcp_features.yaml](../config/mcp_features.yaml) | Configuration | 347 lines |

**Total:** ~3,900 lines of documentation

---

## Features at a Glance

### 8 Domain Areas

1. **Config** - Application settings
2. **Strategy** - Trading strategy management
3. **Screener** - Market scanning
4. **Positions** - Open position management
5. **Orders** - Order lifecycle
6. **Daily Review** - Combined workflow
7. **Backtest** - Historical simulation
8. **Social** - Sentiment analysis (optional)

### 29 Tools Total

- **15 Read operations** (query data)
- **14 Write operations** (modify data)

---

## Implementation Timeline

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | Week 1 | Foundation (server structure, config) |
| Phase 2 | Week 2 | Simple reads (config, strategy) |
| Phase 3 | Week 3 | Simple writes (config, strategy CRUD) |
| Phase 4 | Week 4 | Portfolio (positions, orders) |
| Phase 5 | Week 5 | Complex ops (screener, backtest) |
| Phase 6 | Week 6 | Testing + docs |

**Total:** 6 weeks, 120-150 hours

---

## Key Finding

**✅ Service layer is already perfect for MCP!**

- No HTTP coupling
- Already using dependency injection
- Stateless and testable
- **Zero refactor needed**

---

## Quick Start (After Implementation)

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
positions = client.call_tool("positions_list", {"status": "open"})

# Run screener
candidates = client.call_tool("screener_run", {"top_n": 10})

# Create order
order = client.call_tool("orders_create", {
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
  positions:
    enabled: true
    tools:
      list:
        enabled: true
      close:
        enabled: true
        confirm_required: true  # Safety!
  
security:
  read_only_mode: false  # Set true for safe testing
  require_confirmation:
    - positions_close
    - orders_fill
```

---

## Testing Strategy

### 3 Levels

1. **Unit Tests** - Tool classes in isolation
2. **Integration Tests** - Full MCP → service → storage
3. **Parity Tests** - Compare FastAPI vs MCP responses

**Target:** 80%+ code coverage

---

## Next Steps

1. ✅ Planning complete (this document)
2. ⏳ Add MCP dependencies
3. ⏳ Create mcp_server/ structure
4. ⏳ Implement Phase 1 (Foundation)
5. ⏳ Incremental development (Phases 2-6)

---

## Support

- **Full Documentation:** See documents listed above
- **Issues:** GitHub Issues
- **Questions:** See MCP_USAGE_GUIDE.md troubleshooting section

---

**Status:** Planning Complete ✅  
**Ready For:** Implementation Phase 1  
**Date:** February 12, 2026
