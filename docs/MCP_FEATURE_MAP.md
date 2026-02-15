# Swing Screener - Application Feature Map

**Purpose:** Complete inventory of all domain features for MCP server integration  
**Date:** February 12, 2026  
**Status:** Analysis Phase

---

## Executive Summary

This document provides a comprehensive mapping of all Swing Screener features, organized by domain. Each feature is categorized by operation type (read/write) and complexity to support incremental MCP server implementation.

---

## Feature Domains

### 1. Configuration Management

**Domain:** Application settings and parameters  
**Current Implementation:** `api/routers/config.py` + `api/services/` (implicit)  
**State:** JSON files (config.json)

| Feature | Type | Complexity | Current Endpoint | Notes |
|---------|------|------------|------------------|-------|
| Get current config | Read | Simple | `GET /api/config` | Returns full config tree |
| Update config | Write | Simple | `PUT /api/config` | Full config replacement |
| Reset to defaults | Write | Simple | `POST /api/config/reset` | Restore factory settings |
| Get default config | Read | Simple | `GET /api/config/defaults` | Template config |

**Service Dependencies:** None (router-only)  
**Data Access:** Direct file I/O via `config.py` module  
**MCP Priority:** High (required for all other features)

---

### 2. Strategy Management

**Domain:** Trading strategy configuration and selection  
**Current Implementation:** `api/routers/strategy.py` + `api/services/strategy_service.py`  
**State:** JSON files (strategies.json, active_strategy.json)

| Feature | Type | Complexity | Current Endpoint | Notes |
|---------|------|------------|------------------|-------|
| List strategies | Read | Simple | `GET /api/strategy` | All available strategies |
| Get active strategy | Read | Simple | `GET /api/strategy/active` | Currently selected |
| Set active strategy | Write | Simple | `POST /api/strategy/active` | Switch strategy |
| Get strategy by ID | Read | Simple | `GET /api/strategy/{id}` | Single strategy details |
| Create strategy | Write | Medium | `POST /api/strategy` | New strategy definition |
| Update strategy | Write | Medium | `PUT /api/strategy/{id}` | Modify existing |
| Delete strategy | Write | Medium | `DELETE /api/strategy/{id}` | Remove strategy |

**Service Dependencies:** `StrategyService` → `StrategyRepository`  
**Data Access:** `swing_screener.strategy.storage` module  
**MCP Priority:** High (core domain concept)

---

### 3. Screener Operations

**Domain:** Market scanning and trade candidate generation  
**Current Implementation:** `api/routers/screener.py` + `api/services/screener_service.py`  
**State:** Ephemeral (results computed on-demand)

| Feature | Type | Complexity | Current Endpoint | Notes |
|---------|------|------------|------------------|-------|
| List universes | Read | Simple | `GET /api/screener/universes` | Available ticker lists |
| Run screener | Read | High | `POST /api/screener/run` | Execute full scan |
| Preview order | Read | Medium | `POST /api/screener/preview-order` | Risk calc for candidate |

**Service Dependencies:**  
- `ScreenerService` → `StrategyRepository`
- Uses `swing_screener.screeners.*`, `swing_screener.data.providers`

**Data Access:**  
- Market data via `MarketDataProvider` (yfinance)
- Universe definitions from CSV files

**MCP Priority:** High (primary workflow entry point)

**Special Considerations:**
- Long-running operation (market data fetch + computation)
- May require progress callbacks for MCP
- Results are transient (not persisted)

---

### 4. Portfolio Management - Positions

**Domain:** Open position tracking and management  
**Current Implementation:** `api/routers/portfolio.py` + `api/services/portfolio_service.py`  
**State:** JSON files (positions.json)

| Feature | Type | Complexity | Current Endpoint | Notes |
|---------|------|------------|------------------|-------|
| List positions | Read | Simple | `GET /api/portfolio/positions` | Filter by status |
| Get position | Read | Simple | `GET /api/portfolio/positions/{id}` | Single position |
| Get stop suggestion | Read | Medium | `GET /api/portfolio/positions/{id}/stop-suggestion` | Calculate trailing stop |
| Update position stop | Write | Medium | `PUT /api/portfolio/positions/{id}/stop` | Modify stop price + sync orders |
| Close position | Write | High | `POST /api/portfolio/positions/{id}/close` | Exit position workflow |

**Service Dependencies:**  
- `PortfolioService` → `PositionsRepository`, `OrdersRepository`
- Uses `swing_screener.portfolio.state`, `swing_screener.execution.orders`

**Data Access:** File-locked JSON (positions.json)

**MCP Priority:** Critical (core workflow)

**Special Considerations:**
- Stop update triggers order synchronization (side effects)
- Close position creates exit order
- Requires market data for P&L calculations

---

### 5. Portfolio Management - Orders

**Domain:** Order lifecycle management  
**Current Implementation:** `api/routers/portfolio.py` + `api/services/portfolio_service.py`  
**State:** JSON files (orders.json)

| Feature | Type | Complexity | Current Endpoint | Notes |
|---------|------|------------|------------------|-------|
| List orders | Read | Simple | `GET /api/portfolio/orders` | Filter by status/ticker |
| Get order snapshot | Read | Medium | `GET /api/portfolio/orders/snapshot` | With price distance calc |
| Get order | Read | Simple | `GET /api/portfolio/orders/{id}` | Single order |
| Create order | Write | High | `POST /api/portfolio/orders` | Full order workflow |
| Fill order | Write | High | `POST /api/portfolio/orders/{id}/fill` | Create position from entry |
| Cancel order | Write | Medium | `DELETE /api/portfolio/orders/{id}` | Remove pending order |

**Service Dependencies:**  
- `PortfolioService` → `OrdersRepository`, `PositionsRepository`
- Uses `swing_screener.execution.order_workflows`, `swing_screener.portfolio.state`

**Data Access:** File-locked JSON (orders.json, positions.json)

**MCP Priority:** Critical (core workflow)

**Special Considerations:**
- Create order: Risk validation, position sizing
- Fill entry order: Creates new position with computed R-values
- Fill exit order: Closes position, updates P&L
- Order snapshot: Requires fresh market data

---

### 6. Daily Review

**Domain:** Combined view of positions + candidates for daily workflow  
**Current Implementation:** `api/routers/daily_review.py` + `api/services/daily_review_service.py`  
**State:** Ephemeral + persisted snapshots

| Feature | Type | Complexity | Current Endpoint | Notes |
|---------|------|------------|------------------|-------|
| Get daily review | Read | High | `GET /api/daily-review` | Screener + position analysis |

**Service Dependencies:**  
- `DailyReviewService` → `PortfolioService`, `ScreenerService`

**Data Access:**  
- Combines screener results + position evaluations
- Auto-saves to `data/daily_reviews/` for audit trail

**MCP Priority:** High (key workflow consolidation)

**Special Considerations:**
- Computationally expensive (runs full screener + position eval)
- Results saved to dated JSON files
- Parameters: `top_n` for candidate limit

---

### 7. Backtesting

**Domain:** Historical strategy simulation  
**Current Implementation:** `api/routers/backtest.py` + `api/services/backtest_service.py`  
**State:** JSON files (backtest_simulations.json) + simulation results

| Feature | Type | Complexity | Current Endpoint | Notes |
|---------|------|------------|------------------|-------|
| Quick backtest | Read | High | `POST /api/backtest/quick` | Recent history only |
| Full backtest | Read | Very High | `POST /api/backtest/run` | Complete simulation |
| List simulations | Read | Simple | `GET /api/backtest/simulations` | Saved results metadata |
| Get simulation | Read | Simple | `GET /api/backtest/simulations/{id}` | Full simulation data |
| Delete simulation | Write | Simple | `DELETE /api/backtest/simulations/{id}` | Remove saved result |

**Service Dependencies:**  
- `BacktestService` → `StrategyRepository`
- Uses `swing_screener.backtest.*` (simulator, performance, equity)

**Data Access:**  
- Market data via provider (historical)
- Simulation results persisted to JSON

**MCP Priority:** Medium (analysis tool, not daily workflow)

**Special Considerations:**
- Long-running operations (minutes for full backtest)
- Large result payloads
- May require streaming/progress for MCP

---

### 8. Social Sentiment Analysis

**Domain:** Social media sentiment scoring  
**Current Implementation:** `api/routers/social.py` + `api/services/social_service.py`  
**State:** Ephemeral (on-demand analysis)

| Feature | Type | Complexity | Current Endpoint | Notes |
|---------|------|------------|------------------|-------|
| Analyze sentiment | Read | Medium | `POST /api/social/analyze` | Twitter/Reddit sentiment |

**Service Dependencies:**  
- `SocialService` → `StrategyRepository`
- Uses `swing_screener.social.*` (collectors, sentiment, integrations)

**Data Access:** External APIs (Twitter, Reddit)

**MCP Priority:** Low (optional feature)

**Special Considerations:**
- Requires API keys/credentials
- Rate-limited external services
- May fail if keys not configured

---

## Feature Summary by Type

### Read Operations (15)
| Domain | Count | Priority |
|--------|-------|----------|
| Config | 2 | High |
| Strategy | 4 | High |
| Screener | 1 | High |
| Positions | 2 | Critical |
| Orders | 3 | Critical |
| Daily Review | 1 | High |
| Backtest | 2 | Medium |
| Social | 0 | Low |

### Write Operations (14)
| Domain | Count | Priority |
|--------|-------|----------|
| Config | 2 | High |
| Strategy | 4 | High |
| Screener | 0 | - |
| Positions | 2 | Critical |
| Orders | 3 | Critical |
| Daily Review | 0 | - |
| Backtest | 1 | Medium |
| Social | 0 | Low |

### Complex Operations (Requires Special Handling)
1. **Screener Run** - Long-running, requires progress feedback
2. **Backtest Run** - Very long-running, large payloads
3. **Create Order** - Complex validation and risk calculations
4. **Fill Order** - Complex state transitions (order → position)
5. **Daily Review** - Combines multiple expensive operations

---

## Service Layer Architecture

### Current DI Pattern (FastAPI Depends)

```
Router → Service → Repository → Storage
         ↓
      Domain Logic (swing_screener.*)
```

**Strengths:**
- Clean separation of concerns
- Already interface-agnostic (services don't depend on HTTP)
- Testable in isolation
- Lightweight DI via FastAPI

**Opportunities:**
- Services can be reused by MCP layer with zero changes
- Same repository layer works for both interfaces
- Configuration can be shared

---

## Data Flow Patterns

### Pattern 1: Simple Read
```
Client → Router → Service.method() → Repository.read() → JSON
```
Example: `GET /api/portfolio/positions`

### Pattern 2: Simple Write
```
Client → Router → Service.method() → Repository.write() → JSON
```
Example: `PUT /api/config`

### Pattern 3: Complex Read (with external deps)
```
Client → Router → Service.method() → [Repository, MarketDataProvider, Domain Logic] → Result
```
Example: `POST /api/screener/run`

### Pattern 4: Complex Write (with side effects)
```
Client → Router → Service.method() → [Repo.write(), Repo2.write(), Domain Logic] → Result
```
Example: `PUT /api/portfolio/positions/{id}/stop` (updates position + syncs orders)

---

## MCP Integration Strategy

### Shared Service Layer
```
┌─────────────┐         ┌─────────────┐
│  FastAPI    │         │ MCP Server  │
│  Routers    │         │  Tools      │
└──────┬──────┘         └──────┬──────┘
       │                       │
       └───────┬───────────────┘
               ▼
       ┌───────────────┐
       │   Services    │
       │  (Shared DI)  │
       └───────┬───────┘
               ▼
       ┌───────────────┐
       │ Repositories  │
       └───────┬───────┘
               ▼
       ┌───────────────┐
       │ JSON Storage  │
       └───────────────┘
```

### Configuration-Driven Exposure

Both FastAPI and MCP will read from a shared configuration file:

```yaml
features:
  config:
    enabled: true
    read: true
    write: true
  strategy:
    enabled: true
    read: true
    write: true
  screener:
    enabled: true
  positions:
    enabled: true
    read: true
    write: true
  orders:
    enabled: true
    read: true
    write: true
  daily_review:
    enabled: false  # Can be toggled
  backtest:
    enabled: true
    write: false  # Read-only for safety
  social:
    enabled: false  # Disabled by default
```

---

## Implementation Recommendations

### Phase 1: Foundation (Week 1)
1. Audit service layer - ensure no HTTP coupling
2. Create `mcp_server/` module structure
3. Add MCP SDK dependencies
4. Implement feature configuration schema

### Phase 2: Read Tools (Week 2)
1. Config read operations
2. Strategy read operations
3. Position/order list operations
4. Start with simple patterns (no external deps)

### Phase 3: Write Tools (Week 3)
1. Config updates
2. Strategy CRUD
3. Order creation (with validation)
4. Position management

### Phase 4: Complex Operations (Week 4)
1. Screener execution (with progress)
2. Daily review
3. Backtest (long-running)

### Phase 5: Testing & Docs (Week 5)
1. Integration tests
2. MCP client examples
3. Documentation updates

---

## Testing Strategy

### Service Layer Tests (Existing)
- Already have `tests/api/*` with service tests
- Services are testable without HTTP
- Continue using pytest

### MCP Tool Tests (New)
- Test each MCP tool in isolation
- Mock service layer
- Verify tool registration
- Test configuration-based enabling/disabling

### Integration Tests (New)
- End-to-end MCP client → server → service flow
- Test both FastAPI and MCP paths for same feature
- Verify identical behavior

---

## Open Questions & Decisions

### Q1: How to handle long-running operations in MCP?
**Options:**
- A: Return immediately with job ID, poll for completion
- B: Streaming responses with progress updates
- C: Synchronous with timeout

**Recommendation:** Start with synchronous (C), add job queue (A) if needed

### Q2: Should MCP tools have 1:1 mapping with API endpoints?
**Recommendation:** Yes, for consistency. Use same request/response models.

### Q3: How to handle authentication?
**Current State:** No auth in FastAPI  
**Recommendation:** Both interfaces evolve together. Add auth to both or neither.

### Q4: Should MCP server run as separate process or embedded?
**Options:**
- A: Separate process (different port, separate startup)
- B: Same process as FastAPI (FastAPI + MCP in one app)

**Recommendation:** A (separate process) for isolation and independent scaling

---

## Dependencies Required

### New Dependencies
```toml
[project.optional-dependencies]
mcp = [
  "mcp>=1.0.0",           # MCP SDK
  "pyyaml>=6.0",          # For config files
]
```

### Existing (Reused)
- FastAPI (for potential HTTP+MCP hybrid)
- Pydantic (for models)
- All existing domain dependencies

---

## File Structure (Proposed)

```
swing_screener/
├── api/                    # Existing FastAPI
│   ├── routers/
│   ├── services/          # Shared with MCP
│   ├── repositories/      # Shared with MCP
│   └── dependencies.py    # DI for FastAPI
│
├── mcp_server/            # New MCP server
│   ├── __init__.py
│   ├── main.py           # MCP server entrypoint
│   ├── config.py         # Feature config loader
│   ├── tools/            # MCP tool definitions
│   │   ├── __init__.py
│   │   ├── config.py     # Config management tools
│   │   ├── strategy.py   # Strategy tools
│   │   ├── screener.py   # Screener tools
│   │   ├── portfolio.py  # Position/order tools
│   │   ├── backtest.py   # Backtest tools
│   │   └── social.py     # Social tools
│   └── dependencies.py   # DI for MCP (reuses api.services)
│
├── config/               # New config directory
│   └── mcp_features.yaml # Feature toggles
│
├── tests/
│   ├── api/              # Existing API tests
│   └── mcp_server/       # New MCP tests
│       ├── test_tools.py
│       └── test_config.py
│
└── docs/
    ├── MCP_FEATURE_MAP.md       # This document
    ├── MCP_ARCHITECTURE.md      # To be created
    ├── MCP_IMPLEMENTATION.md    # To be created
    └── MCP_USAGE_GUIDE.md       # To be created
```

---

## Next Steps

1. ✅ Create this feature map
2. ⏳ Create MCP architecture design document
3. ⏳ Create configuration schema with examples
4. ⏳ Create incremental implementation roadmap
5. ⏳ Begin Phase 1 implementation

---

**Document Status:** Complete  
**Review Date:** February 12, 2026  
**Next Review:** After architecture design (Phase 2)
