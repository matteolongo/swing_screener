# MCP Server Coverage Audit

> **Status: Snapshot.**  
> **Last Reviewed:** February 17, 2026.

**Date:** 2026-02-17  
**Status:** Complete mapping of all API endpoints vs MCP tools

---

## Summary

| Domain | API Endpoints | MCP Tools | Coverage % | Missing Tools |
|--------|--------------|-----------|------------|---------------|
| **Portfolio** | 11 | 9 | 82% | ✅ Nearly complete |
| **Screener** | 3 | 3 | 100% | ✅ Complete |
| **Strategy** | 7 | 4 | 57% | ❌ 3 missing |
| **Config** | 4 | 2 | 50% | ❌ 2 missing |
| **Daily Review** | 1 | 2 | 200% | ✅ Extra tools |
| **Social** | 3 | 2 | 67% | ❌ 1 missing |
| **Intelligence** | 4 | 0 | 0% | ❌ Not mapped |
| **Backtest** | 5 | 0 | 0% | ❌ Not mapped |
| **TOTAL** | **38** | **22** | **58%** | **16 missing** |

---

## Detailed Coverage by Domain

### ✅ Portfolio (82% coverage - 9/11 tools)

| API Endpoint | HTTP Method | MCP Tool | Status |
|--------------|-------------|----------|--------|
| `/positions` | GET | `list_positions` | ✅ Mapped |
| `/positions/{position_id}` | GET | `get_position` | ✅ Mapped |
| `/positions/{position_id}/stop` | PUT | `update_position_stop` | ✅ Mapped |
| `/positions/{position_id}/stop-suggestion` | GET | `suggest_position_stop` | ✅ Mapped |
| `/positions/{position_id}/close` | POST | `close_position` | ✅ Mapped |
| `/orders` | GET | `list_orders` | ✅ Mapped |
| `/orders` | POST | `create_order` | ✅ Mapped |
| `/orders/{order_id}` | GET | ❌ **MISSING** | No MCP tool |
| `/orders/{order_id}/fill` | POST | `fill_order` | ✅ Mapped |
| `/orders/{order_id}` | DELETE | `cancel_order` | ✅ Mapped |
| `/orders/snapshot` | GET | ❌ **MISSING** | No MCP tool |

**Missing Tools:**
1. `get_order` - Get single order by ID
2. `get_orders_snapshot` - Get orders snapshot (asof date + orders list)

---

### ✅ Screener (100% coverage - 3/3 tools)

| API Endpoint | HTTP Method | MCP Tool | Status |
|--------------|-------------|----------|--------|
| `/universes` | GET | `list_universes` | ✅ Mapped |
| `/run` | POST | `run_screener` | ✅ Mapped |
| `/preview-order` | POST | `preview_order` | ✅ Mapped |

**Status:** ✅ **COMPLETE** - All screener functionality is mapped!

---

### ⚠️ Strategy (57% coverage - 4/7 tools)

| API Endpoint | HTTP Method | MCP Tool | Status |
|--------------|-------------|----------|--------|
| `/` | GET | `list_strategies` | ✅ Mapped |
| `/{strategy_id}` | GET | `get_strategy` | ✅ Mapped |
| `/active` | GET | `get_active_strategy` | ✅ Mapped |
| `/active` | POST | `set_active_strategy` | ✅ Mapped |
| `/` | POST | ❌ **MISSING** | No MCP tool |
| `/{strategy_id}` | PUT | ❌ **MISSING** | No MCP tool |
| `/{strategy_id}` | DELETE | ❌ **MISSING** | No MCP tool |

**Missing Tools:**
1. `create_strategy` - Create new strategy
2. `update_strategy` - Update existing strategy
3. `delete_strategy` - Delete strategy

---

### ⚠️ Config (50% coverage - 2/4 tools)

| API Endpoint | HTTP Method | MCP Tool | Status |
|--------------|-------------|----------|--------|
| `/` | GET | `get_config` | ✅ Mapped |
| `/` | PUT | `update_config` | ✅ Mapped |
| `/reset` | POST | ❌ **MISSING** | No MCP tool |
| `/defaults` | GET | ❌ **MISSING** | No MCP tool |

**Missing Tools:**
1. `reset_config` - Reset config to defaults
2. `get_default_config` - Get default configuration values

---

### ✅ Daily Review (200% coverage - 2/1 API endpoints)

| API Endpoint | HTTP Method | MCP Tool | Status |
|--------------|-------------|----------|--------|
| `/` | GET | `get_daily_review` | ✅ Mapped |
| N/A | N/A | `get_candidate_recommendations` | ✅ Helper tool |

**Status:** ✅ **COMPLETE** - Even has an extra helper tool!

---

### ⚠️ Social (67% coverage - 2/3 tools)

| API Endpoint | HTTP Method | MCP Tool | Status |
|--------------|-------------|----------|--------|
| `/providers` | GET | ❌ **MISSING** | No MCP tool |
| `/analyze` | POST | `analyze_ticker_sentiment` | ✅ Mapped |
| `/warmup/{job_id}` | GET | `get_social_sentiment` | ✅ Mapped (?) |

**Note:** `get_social_sentiment` might not match `/warmup/{job_id}` exactly. Need verification.

**Missing Tools:**
1. `list_social_providers` - Get available social sentiment providers

---

### ❌ Intelligence (0% coverage - 0/4 tools)

| API Endpoint | HTTP Method | MCP Tool | Status |
|--------------|-------------|----------|--------|
| `/run` | POST | ❌ **MISSING** | Not mapped |
| `/run/{job_id}` | GET | ❌ **MISSING** | Not mapped |
| `/opportunities` | GET | ❌ **MISSING** | Not mapped |
| `/classify` | POST | ❌ **MISSING** | Not mapped |

**Missing Tools:**
1. `run_intelligence` - Launch intelligence analysis
2. `get_intelligence_status` - Check intelligence job status
3. `list_intelligence_opportunities` - Get intelligence opportunities
4. `classify_news_sentiment` - LLM-powered news classification

**Impact:** Intelligence features (AI-powered trade discovery) are **completely unmapped**!

---

### ❌ Backtest (0% coverage - 0/5 tools)

| API Endpoint | HTTP Method | MCP Tool | Status |
|--------------|-------------|----------|--------|
| `/quick` | POST | ❌ **MISSING** | Not mapped |
| `/run` | POST | ❌ **MISSING** | Not mapped |
| `/simulations` | GET | ❌ **MISSING** | Not mapped |
| `/simulations/{sim_id}` | GET | ❌ **MISSING** | Not mapped |
| `/simulations/{sim_id}` | DELETE | ❌ **MISSING** | Not mapped |

**Missing Tools:**
1. `run_quick_backtest` - Run quick backtest with recent data
2. `run_full_backtest` - Run comprehensive backtest
3. `list_backtest_simulations` - List saved simulations
4. `get_backtest_simulation` - Get simulation details
5. `delete_backtest_simulation` - Delete saved simulation

**Impact:** Backtesting features (strategy validation) are **completely unmapped**!

---

## Priority Recommendations

### 🔴 HIGH PRIORITY (Core Missing Features)

1. **Intelligence Domain** (4 tools) - AI-powered trade discovery
   - Critical for daily workflow
   - Used by Daily Review feature
   - Tools: `run_intelligence`, `get_intelligence_status`, `list_intelligence_opportunities`, `classify_news_sentiment`

2. **Backtest Domain** (5 tools) - Strategy validation
   - Essential for testing strategies
   - Required before live trading
   - Tools: `run_quick_backtest`, `run_full_backtest`, `list_backtest_simulations`, etc.

### 🟡 MEDIUM PRIORITY (Strategy Management)

3. **Strategy CRUD** (3 tools)
   - Currently read-only in MCP
   - Need create/update/delete for full management
   - Tools: `create_strategy`, `update_strategy`, `delete_strategy`

### 🟢 LOW PRIORITY (Convenience Features)

4. **Config Helpers** (2 tools)
   - `reset_config`, `get_default_config`
   - Nice to have but not critical

5. **Portfolio Helpers** (2 tools)
   - `get_order`, `get_orders_snapshot`
   - Minor convenience tools

6. **Social Providers** (1 tool)
   - `list_social_providers`
   - Discovery tool, low impact

---

## Implementation Estimate

| Priority | Tools | Estimated Effort | Status |
|----------|-------|------------------|--------|
| 🔴 HIGH | 9 tools | ~16 hours (2 days) | Not started |
| 🟡 MEDIUM | 3 tools | ~6 hours (0.75 days) | Not started |
| 🟢 LOW | 5 tools | ~4 hours (0.5 days) | Not started |
| **TOTAL** | **17 tools** | **~26 hours (3.25 days)** | **Not started** |

---

## Verification Checklist

When implementing missing tools:

- [ ] Tool inherits from `BaseTool`
- [ ] Service layer reused (no business logic in tool)
- [ ] Input schema validates all parameters
- [ ] Output matches API response model
- [ ] Tool registered in `tools/registry.py`
- [ ] Tool added to `config/mcp_features.yaml`
- [ ] Unit tests added in `tests/mcp_server/`
- [ ] README.md updated with tool documentation

---

## Conclusion

**Current State:**
- 22 tools implemented (58% coverage)
- Core portfolio and screener workflows are well-covered
- **Intelligence and Backtest domains are completely missing**

**Recommended Action:**
1. Implement **Intelligence domain** first (critical for daily workflow)
2. Implement **Backtest domain** second (essential for strategy validation)
3. Add **Strategy CRUD** third (improve strategy management)
4. Add remaining convenience tools as time permits

**Timeline:** ~3-4 days of focused work to reach **95%+ coverage**

---

**Generated:** 2026-02-17  
**Next Review:** After Phase 5 implementation
