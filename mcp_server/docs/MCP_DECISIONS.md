# MCP Server - Architectural Decisions & Assumptions

> **Status: Archived decision log.** Implementation completed in February 2026; validate against current MCP server behavior.  
> **Last Reviewed:** February 17, 2026.
> **Note:** Tool naming in this document reflects pre-implementation conventions (e.g., `positions_list`), not the current `list_positions` style.

**Purpose:** Document key decisions, assumptions, and rationale for MCP integration  
**Date:** February 12, 2026  
**Status:** Planning Phase - Analysis Complete

---

## Overview

This document records all architectural decisions made during the MCP server planning phase. Each decision includes rationale, alternatives considered, and implications.

---

## Decision Log

### ADR-001: Use Existing Service Layer (No Refactor)

**Status:** Accepted ✅

**Context:**
- Existing FastAPI has service layer (api/services/)
- Services use dependency injection (FastAPI Depends)
- Need to determine if services can be shared with MCP

**Decision:**
Reuse existing service layer without modification. MCP tools will call the same services as FastAPI routers.

**Rationale:**
- Services have no HTTP coupling (validated during audit)
- Already using dependency injection pattern
- Services are stateless and pure
- Services throw domain exceptions (not HTTP exceptions)
- **Zero refactor risk**

**Alternatives Considered:**
1. **Refactor services first** - Rejected: Not needed, services are already perfect
2. **Create separate MCP services** - Rejected: Would duplicate business logic
3. **Use HTTP client to call FastAPI** - Rejected: Adds latency, tight coupling

**Implications:**
- ✅ No breaking changes to existing API
- ✅ Guaranteed consistency between interfaces
- ✅ No code duplication
- ✅ Low implementation risk
- ⚠️ Must ensure services remain protocol-agnostic

**Validation:**
```python
# api/services/portfolio_service.py (EXISTING)
class PortfolioService:
    def list_positions(self, status=None):
        # No HTTP! No request/response objects! ✅
        return self.positions_repo.list_positions(status)
```

---

### ADR-002: Separate Processes for FastAPI and MCP

**Status:** Accepted ✅

**Context:**
- Need to decide deployment topology
- FastAPI runs on port 8000
- MCP needs to run somewhere

**Decision:**
Run FastAPI and MCP as separate processes on different ports (8000 and 8001).

**Rationale:**
- Independent lifecycle (can restart one without affecting other)
- Easier to disable MCP if not needed
- Better isolation and debugging
- Matches existing architecture (separate api/ directory)
- Can scale independently in future

**Alternatives Considered:**
1. **Same process** - Rejected: Tight coupling, harder to manage
2. **Different machines** - Rejected: Overkill for initial implementation

**Implications:**
- ✅ Clean separation of concerns
- ✅ Can disable MCP without affecting FastAPI
- ⚠️ Need to manage two processes (startup scripts help)
- ⚠️ Both access same JSON files (file locking handles this)

**Startup:**
```bash
# Terminal 1: FastAPI
uvicorn api.main:app --port 8000

# Terminal 2: MCP
python -m mcp_server.main --port 8001
```

---

### ADR-003: YAML Configuration for Feature Toggles

**Status:** Accepted ✅

**Context:**
- Need to control which features/tools are exposed
- Want to avoid code changes for enable/disable
- Need human-readable format

**Decision:**
Use YAML configuration file (config/mcp_features.yaml) for feature toggles.

**Rationale:**
- Human-readable and editable
- Supports comments (documentation)
- Standard format with good Python support (PyYAML)
- Easy to version control
- No code changes needed to enable/disable features

**Alternatives Considered:**
1. **JSON** - Rejected: No comments, less readable
2. **Python file** - Rejected: Security risk, harder to edit
3. **Database** - Rejected: Overkill for configuration
4. **Environment variables** - Rejected: Too many variables

**Implications:**
- ✅ Non-technical users can edit configuration
- ✅ Configuration is versioned
- ✅ Easy to create presets (dev/staging/prod)
- ⚠️ Requires server restart to apply changes
- ⚠️ Need to add PyYAML dependency

**Example:**
```yaml
features:
  positions:
    enabled: true
    tools:
      list:
        enabled: true
      close:
        enabled: false  # Disable dangerous operation
```

---

### ADR-004: Tool Naming Convention

**Status:** Accepted ✅

**Context:**
- Need consistent naming for MCP tools
- Should be intuitive and discoverable
- Should map to existing API structure

**Decision:**
Use `<domain>_<operation>` format (e.g., `positions_list`, `orders_create`).

**Rationale:**
- Clear domain grouping
- Matches REST endpoint structure (GET /api/portfolio/positions → positions_list)
- Easy to understand and remember
- Consistent with existing naming patterns

**Alternatives Considered:**
1. **Flat namespace** (e.g., `list_positions`) - Rejected: Harder to group
2. **Nested namespaces** (e.g., `portfolio.positions.list`) - Rejected: Not MCP convention
3. **Abbreviated names** (e.g., `pos_list`) - Rejected: Less clear

**Implications:**
- ✅ Intuitive tool names
- ✅ Easy to map to API endpoints
- ✅ Clear domain boundaries

**Examples:**
```python
config_get
config_update
strategy_list
strategy_get
positions_list
positions_update_stop
orders_create
orders_fill
screener_run
backtest_full
```

---

### ADR-005: Domain Exceptions (Not HTTP Exceptions)

**Status:** Accepted ✅

**Context:**
- Services need to signal errors
- FastAPI uses HTTPException
- MCP uses different error format
- Need interface-agnostic error handling

**Decision:**
Services throw domain exceptions (NotFoundError, ValidationError). Each interface maps to its protocol.

**Rationale:**
- Services remain protocol-agnostic
- Each interface can format errors appropriately
- Clear separation of concerns
- Easy to test

**Alternatives Considered:**
1. **HTTP exceptions everywhere** - Rejected: Couples services to HTTP
2. **Generic Exception** - Rejected: Loses error semantics
3. **Result objects** - Considered but rejected for simplicity

**Implications:**
- ✅ Services remain protocol-agnostic
- ✅ Easy to add new interfaces
- ⚠️ Need to create domain exception classes
- ⚠️ Each interface needs error mapping

**Implementation:**
```python
# api/services/exceptions.py (NEW)
class DomainError(Exception): pass
class NotFoundError(DomainError): pass
class ValidationError(DomainError): pass

# FastAPI mapping
try:
    service.get_position(id)
except NotFoundError as e:
    raise HTTPException(status_code=404, detail=str(e))

# MCP mapping
try:
    service.get_position(id)
except NotFoundError as e:
    return ToolResult(success=False, error=f"Not found: {e}")
```

---

### ADR-006: Configuration-Based Tool Registration

**Status:** Accepted ✅

**Context:**
- Have 29 tools to register
- Some tools should be optional (e.g., social sentiment)
- Want to enable/disable without code changes

**Decision:**
MCP server reads config/mcp_features.yaml at startup and only registers enabled tools.

**Rationale:**
- Flexible enablement/disablement
- No code changes needed
- Easy to create presets
- Supports gradual rollout

**Alternatives Considered:**
1. **Register all tools always** - Rejected: No control
2. **Compile-time flags** - Rejected: Requires rebuild
3. **Runtime feature flags in database** - Rejected: Overkill

**Implications:**
- ✅ Easy to control which tools are available
- ✅ Can disable dangerous operations
- ✅ Supports different environments (dev/prod)
- ⚠️ Configuration must be validated at startup

**Implementation:**
```python
# mcp_server/main.py
config = MCPConfig("config/mcp_features.yaml")

if config.is_tool_enabled("positions", "list"):
    server.register_tool(ListPositionsTool(portfolio_service))

if config.is_tool_enabled("positions", "close"):
    server.register_tool(ClosePositionTool(portfolio_service))
```

---

### ADR-007: Confirmation Requirements for Dangerous Operations

**Status:** Accepted ✅

**Context:**
- Some operations are destructive (close position, delete strategy)
- Want to prevent accidents
- But also want to allow when intentional

**Decision:**
Require explicit `confirmed: true` parameter for dangerous operations (configurable in YAML).

**Rationale:**
- Prevents accidental destructive operations
- Clear user intent required
- Configurable per-tool
- Simple to implement

**Alternatives Considered:**
1. **No confirmation** - Rejected: Too risky
2. **Always require confirmation** - Rejected: Annoying for safe operations
3. **Two-step workflow** - Rejected: More complex

**Implications:**
- ✅ Safety against accidents
- ✅ Clear user intent required
- ⚠️ Slightly more verbose tool calls

**Configuration:**
```yaml
security:
  require_confirmation:
    - config_reset
    - strategy_delete
    - positions_close
    - orders_fill
```

**Usage:**
```python
# Without confirmation (fails)
result = client.call_tool("positions_close", {"position_id": "pos-123"})
# Error: "Confirmation required. Add 'confirmed: true' to proceed."

# With confirmation (succeeds)
result = client.call_tool("positions_close", {
    "position_id": "pos-123",
    "confirmed": True  # Explicit intent
})
```

---

### ADR-008: Read-Only Mode

**Status:** Accepted ✅

**Context:**
- Need safe mode for testing/demos
- Want to prevent accidental writes
- Should be easy to toggle

**Decision:**
Add `read_only_mode` flag in security configuration. When true, all write operations fail.

**Rationale:**
- Safe for demos and testing
- Prevents accidental data modification
- Simple on/off switch
- Can be used for read-only AI assistants

**Alternatives Considered:**
1. **Separate read-only server** - Rejected: More complex
2. **User-based permissions** - Rejected: Overkill for localhost

**Implications:**
- ✅ Safe testing environment
- ✅ Read-only AI assistants possible
- ⚠️ Need to check in every write tool

**Configuration:**
```yaml
security:
  read_only_mode: true  # All writes disabled
```

**Implementation:**
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

---

### ADR-009: Configurable Timeouts

**Status:** Accepted ✅

**Context:**
- Some operations take minutes (screener, backtest)
- Different operations have different durations
- Need to prevent indefinite hangs

**Decision:**
Configurable timeouts per tool with defaults (30s default, 600s max).

**Rationale:**
- Prevents indefinite hangs
- Allows long operations to complete
- Flexible per-tool configuration
- Clear failure mode

**Alternatives Considered:**
1. **Fixed timeout for all** - Rejected: Doesn't fit all operations
2. **No timeout** - Rejected: Can hang indefinitely
3. **Adaptive timeout** - Rejected: Too complex

**Implications:**
- ✅ Prevents hangs
- ✅ Flexible per operation
- ⚠️ Need to tune timeouts for your environment

**Configuration:**
```yaml
execution:
  default_timeout_seconds: 30
  max_timeout_seconds: 600

features:
  screener:
    tools:
      run:
        timeout_seconds: 300  # 5 minutes
  backtest:
    tools:
      full:
        timeout_seconds: 600  # 10 minutes
```

---

### ADR-010: No Authentication (Localhost Only)

**Status:** Accepted (with caveats) ⚠️

**Context:**
- FastAPI has no authentication currently
- MCP typically for localhost development
- Adding auth adds complexity

**Decision:**
Start with no authentication (localhost only). Add authentication in Phase 7 if needed for remote deployment.

**Rationale:**
- Matches existing FastAPI (no auth)
- Simplifies initial implementation
- MCP typically localhost use case
- Can add later without breaking changes

**Alternatives Considered:**
1. **Add auth immediately** - Rejected: Adds complexity, not needed for localhost
2. **Use API keys** - Rejected: Overkill for localhost

**Implications:**
- ✅ Simpler implementation
- ✅ Matches existing API
- ⚠️ **DO NOT expose to internet without auth**
- ⚠️ Only safe for localhost/trusted networks

**Future:**
When adding auth (Phase 7):
- Add to both FastAPI and MCP simultaneously
- Use same authentication mechanism
- Maintain interface parity

**Security Note:**
```bash
# SAFE: Bind to localhost only
python -m mcp_server.main --host 127.0.0.1

# UNSAFE: Bind to all interfaces (DO NOT DO without auth)
# python -m mcp_server.main --host 0.0.0.0
```

---

### ADR-011: Incremental Implementation (6 Phases)

**Status:** Accepted ✅

**Context:**
- 29 tools to implement
- Want to minimize risk
- Need to validate approach early

**Decision:**
Implement in 6 phases over 6 weeks, starting with simple operations and building up to complex.

**Rationale:**
- Reduces risk (can stop if issues found)
- Validates approach early
- Delivers value incrementally
- Easy to adjust plan based on learnings

**Alternatives Considered:**
1. **Implement all at once** - Rejected: High risk, hard to debug
2. **Implement by domain** - Rejected: All tools same complexity in one domain

**Implications:**
- ✅ Low risk approach
- ✅ Early validation
- ✅ Incremental value delivery
- ⚠️ Takes longer (6 weeks vs 2-3 weeks all-at-once)

**Phases:**
1. Week 1: Foundation (structure, config)
2. Week 2: Simple reads (config, strategy)
3. Week 3: Simple writes (CRUD)
4. Week 4: Portfolio operations (critical path)
5. Week 5: Complex operations (screener, backtest)
6. Week 6: Testing + documentation

---

## Assumptions

### A-001: Service Layer Assumptions

**Assumption:** Services remain protocol-agnostic (no HTTP coupling added in future)

**Validation:** Code review process must check for HTTP coupling

**Risk:** LOW - Team aware of architecture

**Mitigation:** Document in AGENTS.md, include in code review checklist

---

### A-002: File Locking Assumptions

**Assumption:** Existing file locking (portalocker) handles concurrent access from both FastAPI and MCP

**Validation:** Tested in existing API tests

**Risk:** LOW - Already proven in production

**Mitigation:** Monitor lock contention metrics

---

### A-003: JSON File Performance

**Assumption:** JSON file storage is acceptable for MCP operations (no database needed initially)

**Validation:** FastAPI already uses JSON files successfully

**Risk:** MEDIUM - May hit performance limits with high load

**Mitigation:** 
- Monitor file I/O performance
- Plan database migration for Phase 7 if needed
- Document known limitations

---

### A-004: MCP SDK Stability

**Assumption:** MCP SDK is stable and won't have breaking changes

**Validation:** Pin version in requirements (mcp>=1.0.0)

**Risk:** MEDIUM - External dependency

**Mitigation:**
- Pin version
- Test before upgrading
- Document version compatibility

---

### A-005: Localhost Deployment

**Assumption:** MCP server will run on localhost (not exposed to internet)

**Validation:** Documentation clearly states localhost only

**Risk:** HIGH if assumption violated

**Mitigation:**
- Default bind to 127.0.0.1
- Document security implications
- Add authentication before remote deployment

---

### A-006: Market Data Provider Availability

**Assumption:** yfinance (market data provider) continues working

**Validation:** Used by existing FastAPI

**Risk:** MEDIUM - External service

**Mitigation:**
- Handle timeouts gracefully
- Consider alternative providers
- Cache data when possible

---

## Constraints

### C-001: Technology Constraints

- **Python 3.10+** - Minimum version for type hints
- **MCP SDK** - Protocol defined by MCP specification
- **FastAPI** - Existing architecture
- **JSON Files** - Current storage mechanism

---

### C-002: Project Constraints

- **No Breaking Changes** - Existing FastAPI must continue working
- **Refactor-First Approach** - Must share service layer (no duplication)
- **Risk-First Philosophy** - Must maintain risk validation
- **Manual Trading** - System remains manual (no auto-execution)

---

### C-003: Resource Constraints

- **Timeline:** 6 weeks preferred
- **Team:** 1 developer
- **Budget:** Internal effort (no external costs)

---

## Risks & Mitigations

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| MCP SDK issues | Medium | High | Pin version, test thoroughly |
| Service coupling added | Low | High | Code review, documentation |
| File lock contention | Low | Medium | Already handled, monitor metrics |
| Long operation timeouts | Medium | Medium | Configurable timeouts |
| Performance issues | Low | Medium | Monitor, optimize if needed |

### Process Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Scope creep | Medium | Medium | Stick to 6-phase plan |
| Testing takes longer | High | Low | Allocate full week |
| Documentation incomplete | Low | Low | Update as we go |

---

## Future Considerations

### Phase 7: Production Hardening

**If deploying beyond localhost:**
1. Add authentication (JWT tokens)
2. Add HTTPS/TLS
3. Add rate limiting
4. Add request logging
5. Add monitoring/alerting

### Phase 8: Enhancements

**Potential future features:**
1. Progress updates for long operations
2. Job queue for async execution
3. WebSocket for real-time updates
4. Result pagination
5. Streaming responses
6. Result caching

---

## Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-12 | Initial architectural decisions | Analysis Team |

---

## Sign-Off

**Status:** Planning Complete ✅

**Reviewed By:** Awaiting stakeholder review

**Approved:** Pending

**Next Review:** After Phase 1 implementation

---

**Last Updated:** February 12, 2026
