# MCP Server Implementation Roadmap

> **Status: Archived (roadmap complete).** Implementation finished in February 2026.  
> **Last Reviewed:** February 17, 2026.
> **Note:** Tool naming in this document reflects pre-implementation conventions (e.g., `positions_list`), not the current `list_positions` style.

**Purpose:** Incremental implementation plan for MCP server integration  
**Approach:** Refactor-first, feature-by-feature, test-driven  
**Date:** February 12, 2026  
**Status:** Planning Phase

---

## Executive Summary

This roadmap outlines a **5-week incremental implementation** to add MCP server capabilities to Swing Screener while maintaining the existing FastAPI + Web UI. The approach emphasizes:

1. **No breaking changes** to existing functionality
2. **Shared service layer** between FastAPI and MCP
3. **Configuration-driven** feature exposure
4. **Test-driven development** with high coverage
5. **Documentation-first** approach

---

## Timeline Overview

| Phase | Duration | Focus | Deliverable |
|-------|----------|-------|-------------|
| **Phase 1** | Week 1 | Foundation + Audit | Service layer validation, MCP structure |
| **Phase 2** | Week 2 | Simple Read Tools | Config + Strategy read operations |
| **Phase 3** | Week 3 | Simple Write Tools | Config + Strategy CRUD operations |
| **Phase 4** | Week 4 | Portfolio Operations | Positions + Orders (full CRUD) |
| **Phase 5** | Week 5 | Complex Operations + Polish | Screener, Backtest, Daily Review |
| **Phase 6** | Week 6 | Testing + Documentation | Integration tests, user guides |

**Total Estimated Effort:** 6 weeks (120-150 hours)

---

## Phase 1: Foundation & Service Layer Audit (Week 1)

**Goal:** Validate that service layer is ready for MCP integration and setup project structure.

### Tasks

#### 1.1 Service Layer Audit ✅
- [x] Review all services for HTTP coupling
- [x] Verify services use domain exceptions (not HTTP)
- [x] Check services are stateless
- [x] Confirm dependency injection pattern

**Current Status:** ✅ Services are already well-designed!
- No HTTP coupling detected
- Services use repositories correctly
- Already using FastAPI `Depends` for DI
- Can be reused by MCP with zero changes

#### 1.2 Add MCP Dependencies
```toml
[project.optional-dependencies]
mcp = [
  "mcp>=1.0.0",           # MCP SDK
  "pyyaml>=6.0",          # For config files
]
```

**Tasks:**
- [ ] Update `pyproject.toml` with MCP dependencies
- [ ] Document installation: `pip install -e ".[mcp]"`
- [ ] Verify no conflicts with existing dependencies

#### 1.3 Create MCP Server Structure
```
mcp_server/
├── __init__.py
├── main.py              # Server entrypoint
├── config.py            # Configuration loader
├── tools/               # Tool definitions
│   ├── __init__.py
│   ├── registry.py      # Tool registration
│   ├── base.py          # Base tool classes
│   └── ... (feature modules added later)
└── dependencies.py      # DI setup (reuses api.dependencies)
```

**Tasks:**
- [ ] Create `mcp_server/` directory structure
- [ ] Implement `config.py` (YAML loader)
- [ ] Create base tool classes
- [ ] Setup tool registry pattern

#### 1.4 Configuration System
- [ ] Validate `config/mcp_features.yaml` schema
- [ ] Implement configuration loader with validation
- [ ] Add configuration tests
- [ ] Document configuration options

#### 1.5 Basic Server Skeleton
- [ ] Implement `mcp_server/main.py` entrypoint
- [ ] Setup logging
- [ ] Add command-line arguments (--config, --port)
- [ ] Test server startup (no tools yet)

**Deliverables:**
- ✅ Service layer audit report
- [ ] MCP server structure
- [ ] Configuration system
- [ ] Server can start (empty tool registry)

**Success Criteria:**
- Server starts without errors
- Configuration loads correctly
- Logs show proper initialization
- Ready to add tools

---

## Phase 2: Simple Read Tools (Week 2)

**Goal:** Implement read-only operations with no external dependencies.

### Focus: Config & Strategy Read Operations

#### 2.1 Config Management Tools

**Tools to Implement:**
1. `config_get` - Get current config
2. `config_get_defaults` - Get default config

**Tasks:**
- [ ] Create `mcp_server/tools/config.py`
- [ ] Implement `GetConfigTool` class
- [ ] Implement `GetDefaultConfigTool` class
- [ ] Add tool registration in `registry.py`
- [ ] Unit tests for each tool
- [ ] Integration test (call tool, verify response)

**Example Tool:**
```python
class GetConfigTool(Tool):
    name = "config_get"
    description = "Get current application configuration"
    
    def input_schema(self):
        return {"type": "object", "properties": {}}
    
    def execute(self, input: ToolInput) -> ToolResult:
        # Import at function level to avoid circular imports
        from api.routers.config import current_config
        return ToolResult(
            success=True,
            content=current_config.model_dump_json()
        )
```

#### 2.2 Strategy Management Read Tools

**Tools to Implement:**
1. `strategy_list` - List all strategies
2. `strategy_get` - Get single strategy
3. `strategy_get_active` - Get active strategy

**Tasks:**
- [ ] Create `mcp_server/tools/strategy.py`
- [ ] Implement three read tool classes
- [ ] Add to tool registry with config check
- [ ] Unit tests (mock service layer)
- [ ] Integration tests (real service)

**Example Tool:**
```python
class ListStrategiesTool(Tool):
    name = "strategy_list"
    description = "List all available trading strategies"
    
    def __init__(self, service: StrategyService):
        self.service = service
    
    def input_schema(self):
        return {"type": "object", "properties": {}}
    
    def execute(self, input: ToolInput) -> ToolResult:
        try:
            strategies = self.service.list_strategies()
            return ToolResult(
                success=True,
                content=[s.model_dump() for s in strategies]
            )
        except Exception as e:
            return ToolResult(success=False, error=str(e))
```

#### 2.3 Error Handling Pattern

**Tasks:**
- [ ] Define error mapping for common exceptions
- [ ] Implement error handler decorator
- [ ] Add consistent error format
- [ ] Test error scenarios

**Pattern:**
```python
def handle_tool_errors(func):
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except NotFoundError as e:
            return ToolResult(success=False, error=f"Not found: {e}")
        except ValidationError as e:
            return ToolResult(success=False, error=f"Invalid: {e}")
        except Exception as e:
            logger.exception("Tool execution failed")
            return ToolResult(success=False, error="Internal error")
    return wrapper
```

**Deliverables:**
- [ ] 5 working read tools (config × 2, strategy × 3)
- [ ] Tool registry with config-based enablement
- [ ] Unit tests (100% coverage for tools)
- [ ] Integration tests (end-to-end)
- [ ] Error handling pattern

**Success Criteria:**
- MCP client can call all 5 tools
- Tools return same data as FastAPI endpoints
- Errors handled gracefully
- Tests pass

---

## Phase 3: Simple Write Tools (Week 3)

**Goal:** Add write operations for config and strategy management.

### Focus: Config & Strategy Write Operations

#### 3.1 Config Write Tools

**Tools to Implement:**
1. `config_update` - Update configuration
2. `config_reset` - Reset to defaults (with confirmation)

**Tasks:**
- [ ] Implement `UpdateConfigTool` class
- [ ] Implement `ResetConfigTool` with confirmation check
- [ ] Add validation of config updates
- [ ] Test write operations + file persistence
- [ ] Test confirmation requirement enforcement

**Confirmation Pattern:**
```python
class ResetConfigTool(Tool):
    def __init__(self, config: MCPConfig):
        self.config = config
    
    def execute(self, input: ToolInput) -> ToolResult:
        # Check confirmation requirement
        if self.config.requires_confirmation("config_reset"):
            if not input.get("confirmed"):
                return ToolResult(
                    success=False,
                    error="Confirmation required. Add 'confirmed: true' to proceed."
                )
        
        # Proceed with reset
        # ...
```

#### 3.2 Strategy Write Tools

**Tools to Implement:**
1. `strategy_set_active` - Switch active strategy
2. `strategy_create` - Create new strategy
3. `strategy_update` - Update existing strategy
4. `strategy_delete` - Delete strategy (with confirmation)

**Tasks:**
- [ ] Implement 4 write tool classes
- [ ] Add validation for strategy data
- [ ] Test CRUD operations
- [ ] Test confirmation for delete
- [ ] Verify file persistence

#### 3.3 Read-Only Mode

**Tasks:**
- [ ] Implement read-only mode check
- [ ] Add decorator for write tools
- [ ] Test that write tools fail in read-only mode
- [ ] Document read-only mode usage

**Pattern:**
```python
def require_write_permission(func):
    def wrapper(self, *args, **kwargs):
        if self.config.security.read_only_mode:
            return ToolResult(
                success=False,
                error="Server is in read-only mode"
            )
        return func(self, *args, **kwargs)
    return wrapper
```

**Deliverables:**
- [ ] 6 working write tools (config × 2, strategy × 4)
- [ ] Confirmation enforcement for dangerous operations
- [ ] Read-only mode implementation
- [ ] Tests for all write operations
- [ ] File persistence verification tests

**Success Criteria:**
- Write operations work correctly
- Data persists to JSON files
- Confirmations required where configured
- Read-only mode prevents writes
- Tests pass

---

## Phase 4: Portfolio Operations (Week 4)

**Goal:** Implement position and order management (core workflow).

### Focus: Positions & Orders (Critical Path)

#### 4.1 Position Read Tools

**Tools to Implement:**
1. `positions_list` - List positions (with filtering)
2. `positions_get` - Get single position
3. `positions_get_stop_suggestion` - Calculate trailing stop

**Tasks:**
- [ ] Create `mcp_server/tools/portfolio.py`
- [ ] Implement 3 position read tools
- [ ] Handle market data fetching (for P&L)
- [ ] Add tests with mocked market data

#### 4.2 Position Write Tools

**Tools to Implement:**
1. `positions_update_stop` - Update stop (+ sync orders)
2. `positions_close` - Close position (with confirmation)

**Tasks:**
- [ ] Implement update stop tool
- [ ] Test order synchronization side effect
- [ ] Implement close position tool with confirmation
- [ ] Test position status transitions

**Special Consideration:**
`positions_update_stop` has side effects (updates orders). Test thoroughly:
```python
def test_update_stop_syncs_orders():
    # Given: Position with old stop and pending order
    # When: Update stop via MCP tool
    # Then: Position stop updated AND order price updated
```

#### 4.3 Order Read Tools

**Tools to Implement:**
1. `orders_list` - List orders (with filtering)
2. `orders_get` - Get single order
3. `orders_get_snapshot` - With market data + distance calc

**Tasks:**
- [ ] Implement 3 order read tools
- [ ] Handle status/ticker filtering
- [ ] Test snapshot with market data

#### 4.4 Order Write Tools

**Tools to Implement:**
1. `orders_create` - Create order (with risk validation)
2. `orders_fill` - Fill order (creates position, with confirmation)
3. `orders_cancel` - Cancel order

**Tasks:**
- [ ] Implement create order with full validation
- [ ] Implement fill order (complex: creates position)
- [ ] Implement cancel order
- [ ] Test all state transitions
- [ ] Test risk validation in create

**Critical Test:**
```python
def test_fill_entry_order_creates_position():
    # Given: Pending BUY_LIMIT order
    # When: Fill order via MCP tool
    # Then: Order marked filled AND position created with correct R-values
```

**Deliverables:**
- [ ] 8 portfolio tools (positions × 5, orders × 3)
- [ ] Order creation with risk validation
- [ ] Order fill → position creation workflow
- [ ] Stop update → order sync workflow
- [ ] Comprehensive tests for all workflows

**Success Criteria:**
- All portfolio operations work
- Complex workflows tested (fill order, update stop)
- Risk validation enforced
- Side effects tested
- FastAPI and MCP return identical results

---

## Phase 5: Complex Operations (Week 5)

**Goal:** Add computationally expensive operations.

### Focus: Screener, Daily Review, Backtest

#### 5.1 Screener Tools

**Tools to Implement:**
1. `screener_list_universes` - List available universes
2. `screener_run` - Execute screener (long-running)
3. `screener_preview_order` - Risk calc for candidate

**Tasks:**
- [ ] Implement 3 screener tools
- [ ] Handle long-running operation (5+ minutes)
- [ ] Add timeout configuration
- [ ] Test with real market data fetch
- [ ] Consider progress updates (optional)

**Timeout Handling:**
```python
class RunScreenerTool(Tool):
    def __init__(self, service: ScreenerService, config: MCPConfig):
        self.service = service
        self.timeout = config.get_timeout("screener", "run")
    
    def execute(self, input: ToolInput) -> ToolResult:
        with timeout(self.timeout):
            result = self.service.run_screener(...)
        return ToolResult(success=True, content=result)
```

#### 5.2 Daily Review Tool

**Tool to Implement:**
1. `daily_review_get` - Combined positions + candidates

**Tasks:**
- [ ] Implement daily review tool
- [ ] Handle long execution time
- [ ] Test snapshot persistence
- [ ] Verify results match API endpoint

**Note:** Daily review is expensive (runs full screener + position eval).

#### 5.3 Backtest Tools

**Tools to Implement:**
1. `backtest_quick` - Quick backtest (2 minutes)
2. `backtest_full` - Full backtest (10+ minutes)
3. `backtest_list_simulations` - List saved results
4. `backtest_get_simulation` - Get single result
5. `backtest_delete_simulation` - Delete saved result

**Tasks:**
- [ ] Implement 5 backtest tools
- [ ] Handle very long operations (10+ min)
- [ ] Test result persistence
- [ ] Handle large result payloads

**Consideration:**
```python
# For very long operations, consider returning job ID
# and adding a separate tool to poll for completion
# (Optional future enhancement)
```

#### 5.4 Social Sentiment (Optional)

**Tool to Implement:**
1. `social_analyze` - Analyze sentiment

**Tasks:**
- [ ] Implement if time permits
- [ ] Mark as requiring API keys
- [ ] Default disabled in config
- [ ] Document API key requirements

**Deliverables:**
- [ ] 9-10 complex operation tools
- [ ] Timeout handling for long operations
- [ ] Tests for complex workflows
- [ ] Performance benchmarks

**Success Criteria:**
- All tools complete within configured timeouts
- Results match FastAPI endpoints
- Large payloads handled correctly
- No memory leaks

---

## Phase 6: Testing & Documentation (Week 6)

**Goal:** Comprehensive testing and user-facing documentation.

### Focus: Integration Tests + Documentation

#### 6.1 Integration Test Suite

**Test Coverage:**
1. **End-to-End Tests**
   - MCP client → server → service → storage
   - Verify full workflow (screener → order → fill → position)
   
2. **Parity Tests**
   - Compare FastAPI vs MCP responses
   - Ensure identical behavior
   
3. **Configuration Tests**
   - Feature toggle enforcement
   - Confirmation requirements
   - Read-only mode
   - Timeout handling

4. **Error Tests**
   - Network errors
   - Service errors
   - Validation errors
   - Timeout errors

**Tasks:**
- [ ] Write 50+ integration tests
- [ ] Achieve 80%+ coverage for MCP code
- [ ] Test all error paths
- [ ] Load testing (concurrent tools)

#### 6.2 Documentation

**Documents to Create:**
1. **User Guide** (`mcp_server/docs/MCP_USAGE_GUIDE.md`)
   - How to install and start MCP server
   - How to configure features
   - Example MCP client usage
   - Troubleshooting guide

2. **Developer Guide** (`mcp_server/docs/MCP_DEVELOPER_GUIDE.md`)
   - How to add new tools
   - Tool development patterns
   - Testing guidelines
   - Architecture overview

3. **Configuration Reference** (`mcp_server/docs/MCP_CONFIG_REFERENCE.md`)
   - Complete config schema
   - All available options
   - Examples for common scenarios

4. **AGENTS.md Update**
   - Add MCP architecture section
   - Document dual interface pattern
   - Update file structure

5. **README.md Update**
   - Add MCP quick start section
   - Update architecture diagram
   - Add MCP badge/status

**Tasks:**
- [ ] Write 5 documentation files
- [ ] Add code examples
- [ ] Create architecture diagrams
- [ ] Record demo video (optional)

#### 6.3 Example MCP Client

**Tasks:**
- [ ] Create example Python client script
- [ ] Show common workflows
- [ ] Document client setup
- [ ] Add to examples/ directory

**Example:**
```python
# examples/mcp_client_demo.py
from mcp import Client

client = Client("http://localhost:8001")

# List strategies
strategies = client.call_tool("strategy_list")
print(f"Found {len(strategies)} strategies")

# Get positions
positions = client.call_tool("positions_list", {"status": "open"})
print(f"Open positions: {len(positions)}")

# Run screener
candidates = client.call_tool("screener_run", {
    "top_n": 10,
    "universe": "sp500"
})
print(f"Top candidates: {candidates[0]['ticker']}")
```

**Deliverables:**
- [ ] Comprehensive integration test suite
- [ ] 5 documentation files
- [ ] Example MCP client
- [ ] Updated AGENTS.md + README.md

**Success Criteria:**
- 80%+ test coverage
- All docs complete and accurate
- Example client works
- Ready for production use

---

## Testing Strategy

### Unit Tests

**Scope:** Individual tool classes in isolation

**Pattern:**
```python
def test_tool_success(mock_service):
    tool = SomeTool(mock_service)
    result = tool.execute({"param": "value"})
    assert result.success
    mock_service.some_method.assert_called_once()

def test_tool_handles_error(mock_service):
    mock_service.some_method.side_effect = NotFoundError()
    tool = SomeTool(mock_service)
    result = tool.execute({})
    assert not result.success
    assert "Not found" in result.error
```

### Integration Tests

**Scope:** Full MCP server with real services

**Pattern:**
```python
def test_tool_integration(mcp_server):
    result = mcp_server.call_tool("positions_list", {})
    assert result["success"]
    assert "positions" in result["data"]
```

### Parity Tests

**Scope:** Compare FastAPI and MCP responses

**Pattern:**
```python
def test_api_mcp_parity(api_client, mcp_server):
    api_result = api_client.get("/api/portfolio/positions")
    mcp_result = mcp_server.call_tool("positions_list", {})
    
    assert api_result.json()["positions"] == mcp_result["data"]["positions"]
```

---

## Risk Management

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| MCP SDK breaking changes | Medium | High | Pin version, test before upgrade |
| Service layer needs refactor | Low | High | Already validated - looks good |
| Performance issues (long operations) | Medium | Medium | Add timeouts, progress updates |
| File locking contention | Low | Medium | Already handled by existing code |
| Large result payloads | Medium | Low | Add pagination (future) |

### Schedule Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Integration tests take longer | High | Medium | Allocate full week (Phase 6) |
| Complex tools need debugging | Medium | Medium | Test incrementally, start simple |
| Documentation takes longer | Low | Low | Start early, update as we go |

---

## Success Metrics

### Functional Requirements
- ✅ All FastAPI features available in MCP
- ✅ Same validation rules in both interfaces
- ✅ Configuration-driven feature exposure
- ✅ No code duplication in business logic

### Non-Functional Requirements
- ✅ 80%+ test coverage
- ✅ Response time < 30s for simple operations
- ✅ Response time < 5min for complex operations
- ✅ Zero breaking changes to existing API

### Quality Metrics
- ✅ All tests pass
- ✅ No regressions in existing features
- ✅ Documentation complete and accurate
- ✅ Code review approved

---

## Post-Implementation

### Phase 7: Monitoring (Ongoing)

**Tasks:**
- [ ] Add metrics for tool execution time
- [ ] Add metrics for error rates
- [ ] Setup alerting for failures
- [ ] Track usage by tool

### Phase 8: Enhancements (Future)

**Possible Future Work:**
1. Progress updates for long operations
2. Job queue for async execution
3. Result pagination
4. Streaming responses
5. WebSocket support for real-time updates
6. Authentication/authorization
7. Rate limiting
8. Result caching

---

## Dependencies

### External Dependencies
- MCP SDK (`mcp>=1.0.0`)
- PyYAML (`pyyaml>=6.0`)

### Internal Dependencies
- Existing service layer (no changes)
- Existing repository layer (no changes)
- Configuration system (new)

---

## Team & Responsibilities

| Role | Responsibility |
|------|----------------|
| Developer | Implement MCP tools, tests, documentation |
| Reviewer | Code review, architecture validation |
| Tester | Integration testing, parity testing |
| PM | Track progress, manage timeline |

---

## Conclusion

This roadmap provides a clear, incremental path to add MCP server capabilities to Swing Screener. The approach:

1. ✅ **Preserves existing functionality** (no breaking changes)
2. ✅ **Reuses service layer** (no duplication)
3. ✅ **Configuration-driven** (easy to enable/disable)
4. ✅ **Test-driven** (high quality)
5. ✅ **Well-documented** (maintainable)

**Total Estimated Effort:** 120-150 hours (6 weeks)

**Next Steps:**
1. Review and approve this roadmap
2. Begin Phase 1 (Foundation)
3. Report progress weekly

---

**Document Status:** Complete  
**Created:** February 12, 2026  
**Next Review:** After Phase 1 completion
