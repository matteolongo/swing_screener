# Account Size Management Review - Executive Summary

**Date:** 2026-02-15  
**Task:** Review account size management and create GitHub issue with improvements  
**Status:** ✅ COMPLETE

---

## What Was Done

### 1. Comprehensive Codebase Analysis

Analyzed the entire account size management system:
- ✅ Configuration (`RiskConfig` with `account_size`, `risk_pct`, `max_position_pct`)
- ✅ Position sizing logic (`position_plan()` in `risk/position_sizing.py`)
- ✅ Portfolio state management (`positions.json`, `orders.json`)
- ✅ Screener behavior (capital awareness)
- ✅ API services (order creation, position management)
- ✅ Current capital allocation (real data analysis)

### 2. Real-World Data Analysis

Analyzed actual positions from `data/positions.json`:

| Component | Amount | Percentage |
|-----------|--------|------------|
| Open Positions (4) | $302.65 | 60.5% of $500 |
| Pending Orders (0) | $0.00 | 0% |
| **Available** | **$197.35** | **39.5%** |

**Critical Finding:** System doesn't track this at all!

### 3. Identified Critical Issues

**PRIMARY ISSUE:** **No capital blocking when placing pending buy orders**

Specific problems:
1. ❌ Pending entry orders DO NOT reserve capital
2. ❌ Position sizing uses TOTAL account size, not AVAILABLE capital
3. ❌ Multiple pending orders can exceed available funds
4. ❌ No portfolio-level visibility of capital allocation
5. ❌ Risk of over-allocation (e.g., 120% if multiple orders fill overnight)

**Example Scenario:**
```
Account: $500
Open: $300 (60%)
→ User creates 3 orders @ $100 each = $300 pending
→ If all fill: $600 total (120% of account!)
→ System ALLOWS this currently ❌
```

### 4. Created Comprehensive Documentation

**File 1: `ACCOUNT_SIZE_ANALYSIS.md`** (25+ pages)
- Current implementation deep-dive
- Problem scenarios with examples
- 3-phase improvement plan
- Complete code implementations
- Testing strategy
- Migration plan
- Open questions and recommendations

**File 2: `.github/ISSUE_TEMPLATE/capital-tracking.md`**
- Ready-to-use GitHub issue template
- Problem statement
- Proposed solution (3 phases)
- Code examples
- Acceptance criteria
- Testing requirements
- Rollout plan

---

## Key Findings Summary

### Current Implementation

**Position Sizing Logic:**
```python
# Uses TOTAL account size, not available capital
risk_amount = cfg.account_size * cfg.risk_pct
max_position_value = cfg.account_size * cfg.max_position_pct

shares = min(shares_by_risk, shares_by_cap)
# ❌ No check against available capital
```

**Screener Behavior:**
```python
# Always empty - no capital awareness
results = build_daily_report(ohlcv, cfg=report_cfg, exclude_tickers=[])
```

**Order Creation:**
- No capital check before creating order
- No tracking of reserved capital
- No error if insufficient funds

### Root Causes

1. **No Capital Tracking Module** - System tracks positions and orders separately but never calculates available capital
2. **No Portfolio-Level Constraint** - Only individual position limits (60%), no total portfolio cap
3. **Pending Orders Ignored** - Status "pending" doesn't affect capital calculations
4. **Screener Unaware** - Generates candidates without checking if user can afford them

---

## Proposed Solution

### Phase 1: Foundation (HIGH PRIORITY) 🔴

**Goal:** Prevent over-allocation at order creation time

**What to build:**

1. **Capital Tracking Module** (`src/swing_screener/portfolio/capital.py`)
   ```python
   @dataclass
   class CapitalState:
       account_size: float
       allocated_positions: float  # Open positions
       reserved_orders: float      # Pending entry orders
       available: float            # Remaining capital
       utilization_pct: float      # Usage percentage
   
   def compute_capital_state(positions, orders, account_size) -> CapitalState
   def check_capital_available(state, required) -> CapitalCheck
   ```

2. **API Endpoint** (`GET /api/portfolio/capital`)
   - Returns current capital allocation state
   - Shows breakdown: account size, allocated, reserved, available

3. **Order Creation Blocker**
   - Update `create_order()` to check capital
   - Return HTTP 400 with details if insufficient
   - Include capital breakdown and shortfall in error

**Impact:** Prevents accidental over-allocation

**Effort:** 1-2 weeks

**Tests Required:**
- Unit tests for capital calculations (>95% coverage)
- Integration tests for order blocking
- Edge case tests (partial fills, etc.)

### Phase 2: Integration (MEDIUM PRIORITY) 🟡

**Goal:** Improve visibility and planning

**What to build:**

1. **Dashboard Capital Widget**
   - Visual progress bar (green/orange/red)
   - Real-time updates
   - Shows: account size, allocated, reserved, available

2. **Updated Position Sizing**
   - Accept `available_capital` parameter
   - Constrain by actual availability
   - Report which constraint limits position (risk/cap/available)

3. **Screener Warnings**
   - Warn when utilization >80%
   - Show available capital in screener results

**Impact:** Better portfolio awareness

**Effort:** 1 week

### Phase 3: Advanced (LOW PRIORITY) ⚪

**Goal:** Advanced portfolio management

**What to build:**

1. Portfolio-level hard cap (e.g., max 90% allocated)
2. Capital forecasting ("what-if all orders fill?")
3. Optional auto-cancel of stale orders

**Impact:** Professional-grade capital management

**Effort:** 1-2 weeks

---

## Benefits of Implementation

### User Benefits
- ✅ **Safety:** Cannot accidentally over-allocate capital
- ✅ **Visibility:** Clear view of capital usage at all times
- ✅ **Planning:** Know available capital before creating orders
- ✅ **Confidence:** System prevents costly mistakes

### Technical Benefits
- ✅ **Data integrity:** Capital state always accurate
- ✅ **Clear errors:** User knows exactly why order was rejected
- ✅ **Testable:** Full test coverage for capital logic
- ✅ **Maintainable:** Clean separation of concerns

### Risk Mitigation
- ✅ **Prevents over-allocation** (120%+ scenarios)
- ✅ **Protects against simultaneous fills**
- ✅ **Enforces portfolio discipline**
- ✅ **Maintains cash reserves**

---

## Next Steps

### For Repository Maintainer

1. **Review Documentation**
   - Read `ACCOUNT_SIZE_ANALYSIS.md` for full details
   - Review `.github/ISSUE_TEMPLATE/capital-tracking.md`

2. **Create GitHub Issue**
   - Use provided template
   - Add any additional context
   - Assign priority and milestone

3. **Plan Implementation**
   - Decide on phase priority
   - Allocate development time
   - Schedule testing and QA

4. **Deploy Strategy**
   - Phase 1 first (critical)
   - Gradual rollout (10% → 50% → 100%)
   - Monitor for issues

### For Implementation Team

1. **Phase 1 Development**
   - Create `capital.py` module
   - Add API endpoint
   - Update `create_order()` service
   - Write comprehensive tests

2. **Testing**
   - Unit tests (capital calculations)
   - Integration tests (order blocking)
   - Manual testing (various scenarios)
   - Edge case validation

3. **Documentation**
   - Update operational guide
   - Document API endpoint
   - Add user-facing docs

4. **Deployment**
   - Deploy to staging
   - Test thoroughly
   - Gradual production rollout
   - Monitor metrics

---

## Questions & Answers

### Q: Is this a critical issue?
**A:** Yes. Current system allows over-allocation (>100% of account), which could lead to failed orders, margin calls, or position sizing errors.

### Q: Does this affect existing positions?
**A:** No. Only affects NEW order creation. Existing positions and orders are grandfathered.

### Q: Is this backward compatible?
**A:** Yes. Can be deployed with `capital_tracking_enabled=false` flag initially for testing.

### Q: How long to implement?
**A:** Phase 1 (critical features): 1-2 weeks. Phase 2 (visibility): +1 week. Phase 3 (advanced): +1-2 weeks.

### Q: What if I disagree with the approach?
**A:** That's fine! The analysis document is comprehensive enough to support alternative solutions. The key finding (no capital tracking) remains valid regardless of implementation approach.

---

## Files Created

1. **`ACCOUNT_SIZE_ANALYSIS.md`** - 25-page comprehensive analysis
2. **`.github/ISSUE_TEMPLATE/capital-tracking.md`** - GitHub issue template
3. **`ACCOUNT_MANAGEMENT_EXECUTIVE_SUMMARY.md`** - This document

---

## Conclusion

The Swing Screener has a **critical gap in capital management**: it does not track or block capital when pending buy orders are placed. This creates real risk of over-allocation.

**Recommendation:** Implement Phase 1 (Foundation) as HIGH PRIORITY to prevent costly over-allocation scenarios.

**Success Criteria:** After implementation, system should:
- Track capital allocation in real-time
- Block orders when capital insufficient
- Provide clear visibility via API and UI
- Prevent >100% capital allocation

**Impact:** High value, medium effort, critical for production use.

---

**Analysis completed by:** GitHub Copilot Agent  
**Date:** 2026-02-15  
**Status:** ✅ Ready for Review
