# MCP Server Integration - Analysis & Planning Summary

> **Status: Archived planning snapshot.** Implementation completed in February 2026; see `/mcp_server/docs/PHASE4_MCP_COMPLETE.md` and `/mcp_server/docs/MCP_SERVER_COMPLETE.md`.  
> **Last Reviewed:** February 17, 2026.


**Project:** Swing Screener MCP Server Integration  
**Approach:** Refactor-First, Coevolution  
**Status:** Planning Complete ✅  
**Date:** February 12, 2026

---

## Executive Summary

This document summarizes the completed analysis and planning work for integrating Model Context Protocol (MCP) server capabilities into the Swing Screener trading system.

### What Was Delivered

✅ **Complete Analysis & Planning Package:**
1. Feature mapping (all 29 features)
2. Architecture design (service-oriented, shared DI)
3. Configuration schema (YAML-based)
4. Implementation roadmap (6-week plan)
5. Usage documentation (examples & workflows)

### Key Findings

**✅ Service Layer Is Already Perfect:**
- No HTTP coupling detected
- Services use domain exceptions (not HTTP)
- Already using dependency injection (FastAPI Depends)
- Stateless and testable
- **Can be reused by MCP with ZERO changes**

**✅ Architecture Supports Dual Interface:**
- FastAPI and MCP can coexist
- Both use same service layer
- Both access same data (JSON files)
- Configuration controls feature exposure
- No code duplication needed

---

## Documents Created

### 1. Feature Map (`mcp_server/docs/MCP_FEATURE_MAP.md`)

**Comprehensive inventory of all application features:**
- 8 domain areas (Config, Strategy, Screener, Positions, Orders, Daily Review, Backtest, Social)
- 29 total features (15 read, 14 write)
- Priority classification (Critical, High, Medium, Low)
- Complexity assessment (Simple, Medium, High, Very High)
- Service dependencies mapped
- Special considerations documented

**Key Insights:**
- Most features are simple read/write operations
- 5 complex operations require special handling (timeouts, progress)
- Positions & Orders are critical path (highest priority)
- Social sentiment is optional (requires API keys)

### 2. Architecture Design (`mcp_server/docs/MCP_ARCHITECTURE.md`)

**Complete architectural blueprint:**

**Layers:**
```
Interface Layer    → FastAPI Routers | MCP Tools
Service Layer      → Shared business logic (no protocol coupling)
Repository Layer   → Data access (JSON files)
Storage Layer      → File-locked JSON storage
```

**Key Patterns:**
- Service-oriented architecture (already in place!)
- Dependency injection (FastAPI Depends)
- Configuration-driven exposure
- Error handling strategy
- Security patterns (confirmations, read-only mode)

**Deployment:**
- Separate processes (FastAPI on 8000, MCP on 8001)
- Independent lifecycle
- Shared service layer via Python imports

### 3. Configuration Schema (`config/mcp_features.yaml`)

**Feature toggle configuration:**
- 8 feature domains
- 29+ individual tools
- Per-tool settings (enabled, timeout, confirmation)
- Security settings (read-only mode, confirmations)
- Execution settings (timeouts, concurrency)
- Logging configuration
- Experimental feature flags

**Example:**
```yaml
features:
  positions:
    enabled: true
    tools:
      list:
        enabled: true
      close:
        enabled: true
        confirm_required: true
security:
  read_only_mode: false
  require_confirmation:
    - positions_close
    - orders_fill
```

### 4. Implementation Roadmap (`mcp_server/docs/MCP_IMPLEMENTATION_ROADMAP.md`)

**6-week incremental plan:**

| Phase | Duration | Focus | Tools |
|-------|----------|-------|-------|
| Phase 1 | Week 1 | Foundation | Server structure, config system |
| Phase 2 | Week 2 | Simple reads | 5 tools (config, strategy) |
| Phase 3 | Week 3 | Simple writes | 6 tools (config, strategy CRUD) |
| Phase 4 | Week 4 | Portfolio ops | 8 tools (positions, orders) |
| Phase 5 | Week 5 | Complex ops | 10 tools (screener, backtest, review) |
| Phase 6 | Week 6 | Testing + docs | Integration tests, guides |

**Total Effort:** 120-150 hours (6 weeks, 1 developer)

**Deliverables per Phase:**
- Working tools (incremental)
- Unit tests (80%+ coverage)
- Integration tests (parity checks)
- Documentation updates

### 5. Usage Guide (`mcp_server/docs/MCP_USAGE_GUIDE.md`)

**User-facing documentation:**
- Installation instructions
- Quick start guide
- Tool reference
- Common workflows (5 examples)
- Error handling patterns
- Troubleshooting guide
- Best practices

**Example Workflows:**
1. Check positions & orders
2. Run screener & create order
3. Update position stops (trailing)
4. Daily review workflow
5. Backtest strategy

---

## Architecture Highlights

### Shared Service Layer (The Key Innovation)

```python
# api/services/portfolio_service.py (EXISTING)
class PortfolioService:
    def __init__(self, orders_repo, positions_repo):
        self.orders_repo = orders_repo
        self.positions_repo = positions_repo
    
    def list_positions(self, status=None):
        # Pure business logic - no HTTP!
        return self.positions_repo.list_positions(status)
```

**This service is used by BOTH:**

```python
# FastAPI router (EXISTING)
@router.get("/positions")
async def get_positions(service: PortfolioService = Depends(get_portfolio_service)):
    return service.list_positions(status=None)

# MCP tool (NEW)
class ListPositionsTool(Tool):
    def __init__(self, service: PortfolioService):
        self.service = service
    
    def execute(self, input):
        return self.service.list_positions(status=input.get("status"))
```

**Result:** No code duplication, guaranteed consistency.

### Configuration-Driven Exposure

Both interfaces read from `config/mcp_features.yaml`:

```yaml
features:
  positions:
    enabled: true
    tools:
      list:
        enabled: true
      close:
        enabled: false  # Can disable dangerous operations
```

MCP server only registers enabled tools:

```python
# mcp_server/main.py
if config.is_tool_enabled("positions", "list"):
    server.register_tool(ListPositionsTool(portfolio_service))
```

**Result:** Easy to enable/disable features without code changes.

---

## Technical Decisions

### Decision 1: Separate Processes vs Unified

**Chosen:** Separate processes (FastAPI on 8000, MCP on 8001)

**Rationale:**
- Independent lifecycle
- Easier to disable MCP if not needed
- Better isolation
- Matches existing architecture (separate api/ directory)

### Decision 2: Service Layer Refactor vs New Implementation

**Chosen:** Reuse existing service layer (no refactor needed!)

**Rationale:**
- Services already interface-agnostic
- No HTTP coupling detected
- Already using dependency injection
- Stateless and testable
- **Zero refactor needed** ✅

### Decision 3: Configuration Format

**Chosen:** YAML (mcp_features.yaml)

**Rationale:**
- Human-readable
- Easy to edit
- Comments supported
- Standard format
- PyYAML available

### Decision 4: Tool Naming Convention

**Chosen:** `<domain>_<operation>` (e.g., `positions_list`, `orders_create`)

**Rationale:**
- Clear domain grouping
- Matches REST endpoint structure
- Easy to understand
- Consistent with existing naming

### Decision 5: Error Handling

**Chosen:** Domain exceptions mapped at interface layer

**Rationale:**
- Services throw domain exceptions (NotFoundError, ValidationError)
- FastAPI maps to HTTP status codes (404, 422)
- MCP maps to error messages
- Same error handling logic reused

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| MCP SDK breaking changes | Medium | High | Pin version, test upgrades |
| Long operations timeout | Medium | Medium | Configurable timeouts |
| File lock contention | Low | Medium | Already handled by existing code |
| Large result payloads | Medium | Low | Add pagination (future) |

### Schedule Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Integration tests take longer | High | Medium | Full week allocated (Phase 6) |
| Complex tools need debugging | Medium | Medium | Test incrementally |
| Documentation takes longer | Low | Low | Start early, update as we go |

**Overall Risk:** LOW (service layer is already perfect!)

---

## Success Metrics

### Functional Requirements
- ✅ All FastAPI features available in MCP
- ✅ Same validation rules
- ✅ Same data returned
- ✅ Configuration-driven exposure

### Quality Requirements
- ✅ 80%+ test coverage
- ✅ No code duplication
- ✅ No breaking changes to existing API
- ✅ Comprehensive documentation

### Performance Requirements
- ✅ Simple operations < 30s
- ✅ Complex operations < 5min (configurable)
- ✅ No memory leaks
- ✅ No file lock contention

---

## Next Steps

### Immediate (This Week)
1. ✅ Complete analysis & planning (DONE)
2. ⏳ Review deliverables with stakeholders
3. ⏳ Get approval to proceed
4. ⏳ Begin Phase 1 implementation

### Phase 1 Implementation (Week 1)
1. Add MCP dependencies to pyproject.toml
2. Create mcp_server/ directory structure
3. Implement configuration loader (config.py)
4. Create base tool classes
5. Setup tool registry
6. Test server startup (empty tool registry)

### Future Phases (Weeks 2-6)
- Follow roadmap in `mcp_server/docs/MCP_IMPLEMENTATION_ROADMAP.md`
- Report progress weekly
- Update documentation as we go
- Run tests continuously

---

## Dependencies

### New External Dependencies
```toml
[project.optional-dependencies]
mcp = [
  "mcp>=1.0.0",      # MCP SDK
  "pyyaml>=6.0",     # Configuration files
]
```

### Reused Internal Dependencies
- All existing services (api/services/)
- All existing repositories (api/repositories/)
- All existing domain logic (src/swing_screener/)

**No changes needed to existing code!** ✅

---

## File Structure (After Implementation)

```
swing_screener/
├── api/                    # EXISTING FastAPI
│   ├── routers/           # HTTP endpoints
│   ├── services/          # Shared with MCP ✅
│   ├── repositories/      # Shared with MCP ✅
│   └── dependencies.py    # Shared with MCP ✅
│
├── mcp_server/            # NEW MCP server
│   ├── __init__.py
│   ├── main.py           # Server entrypoint
│   ├── config.py         # Config loader
│   ├── tools/            # Tool definitions
│   │   ├── config.py
│   │   ├── strategy.py
│   │   ├── portfolio.py
│   │   ├── screener.py
│   │   └── backtest.py
│   └── dependencies.py   # Reuses api.services
│
├── config/               # NEW config directory
│   └── mcp_features.yaml # Feature toggles
│
├── mcp_server/docs/      # MCP documentation
│   ├── MCP_FEATURE_MAP.md          ✅ NEW
│   ├── MCP_ARCHITECTURE.md         ✅ NEW
│   ├── MCP_IMPLEMENTATION_ROADMAP.md ✅ NEW
│   ├── MCP_USAGE_GUIDE.md          ✅ NEW
│   └── MCP_SUMMARY.md              ✅ NEW (this file)
│
└── tests/
    └── mcp_server/       # NEW MCP tests
        ├── test_tools.py
        └── test_config.py
```

---

## Comparison: Before vs After

### Before (Current State)
```
User → Web UI → FastAPI → Services → Repositories → JSON Files
```

**One interface, manual trading only**

### After (With MCP)
```
User → Web UI → FastAPI ↘
                         Services → Repositories → JSON Files
AI   → MCP Client → MCP Server ↗
```

**Two interfaces, same business logic, AI-assisted trading**

---

## Key Innovations

### 1. Zero Service Layer Changes
- Services already perfect for sharing ✅
- No refactor needed ✅
- No risk of breaking existing API ✅

### 2. Configuration-Driven Architecture
- Enable/disable features via YAML
- No code changes to add/remove tools
- Easy to maintain

### 3. Dual Interface Coevolution
- Both interfaces use same services
- Add feature once, available in both
- Guaranteed data consistency

### 4. Incremental Implementation
- 6-week roadmap with clear milestones
- Test continuously
- Low risk

---

## Stakeholder Benefits

### For Users
- AI assistance with trading (via MCP)
- Natural language interface ("show my positions")
- Automation possibilities
- Keep existing Web UI

### For Developers
- No code duplication
- Clean architecture
- Easy to add new features
- Well-documented

### For Business
- Low implementation risk (service layer is ready)
- Reasonable timeline (6 weeks)
- No breaking changes
- Future-proof architecture

---

## Open Questions (For Discussion)

### Q1: Should we implement all 29 features or start with subset?

**Recommendation:** Start with core features (Phases 2-4), add advanced features (Phase 5) if time permits.

**Core features (must-have):**
- Config management
- Strategy management
- Positions & Orders
- Screener (basic)

**Advanced features (nice-to-have):**
- Daily review
- Backtesting
- Social sentiment

### Q2: Authentication strategy?

**Current state:** No auth in FastAPI or MCP (localhost only)

**Options:**
1. Add auth to both (synchronized)
2. Keep localhost-only (no auth)
3. Add auth later (Phase 7)

**Recommendation:** Keep localhost-only initially, add auth in Phase 7 if deploying remotely.

### Q3: Should we support WebSocket for real-time updates?

**Current state:** HTTP REST only

**Recommendation:** Start with request-response (simpler), add WebSocket in Phase 8 if needed.

---

## Conclusion

### Analysis Complete ✅

We have:
- ✅ Mapped all 29 features
- ✅ Designed complete architecture
- ✅ Created configuration schema
- ✅ Planned 6-week implementation
- ✅ Written comprehensive documentation

### Key Finding

**The service layer is already perfect for MCP integration!**

No refactor needed. We can reuse 100% of existing business logic.

### Ready to Implement

The planning phase is complete. All analysis and design documents are ready. We can begin Phase 1 implementation immediately.

**Next Action:** Get approval and start Phase 1 (Foundation) this week.

---

## Appendix: Document Index

| Document | Purpose | Status |
|----------|---------|--------|
| `MCP_FEATURE_MAP.md` | Complete feature inventory | ✅ Complete |
| `MCP_ARCHITECTURE.md` | Architecture design | ✅ Complete |
| `MCP_IMPLEMENTATION_ROADMAP.md` | 6-week implementation plan | ✅ Complete |
| `MCP_USAGE_GUIDE.md` | User documentation | ✅ Complete |
| `MCP_SUMMARY.md` | This summary document | ✅ Complete |
| `config/mcp_features.yaml` | Configuration schema | ✅ Complete |

**Total Documentation:** 6 files, ~100 pages

---

**Document Status:** Complete  
**Created:** February 12, 2026  
**Review Status:** Awaiting approval  
**Next Action:** Begin Phase 1 implementation
