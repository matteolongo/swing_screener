# Welcome, AI Agent! 🤖

> **Status: Needs review.** Branch name and next feature are time-sensitive; verify against current roadmap.  
> **Last Reviewed:** February 17, 2026.

**Last Updated:** February 11, 2026  
**Current Branch:** v2/daily-routine-revamp (ready to merge)  
**Next Feature:** Currency Filter (planned)

---

## 👋 Start Here

You're working on **Swing Screener** - a systematic swing-trading framework for US equities.

**Before coding:** Read these in order:
1. ✅ **This file** (WELCOME.md) - Onboarding overview
2. ✅ **AGENTS.md** - Project philosophy and constraints
3. ✅ **ROADMAP.md** - Feature status and priorities
4. ✅ **Session plan.md** - Current task breakdown (if in session)

---

## 🎯 Current State (February 2026)

### ✅ What's Working (Production Ready)

**Web UI (React + TypeScript)**
- ✅ Dashboard - Overview and quick stats
- ✅ Screener - Run screening with filters, see candidates
- ✅ Daily Review - Unified dashboard (NEW! Just completed)
- ✅ Orders - CRUD operations for entry/stop orders
- ✅ Positions - Track open trades, update stops
- ✅ Settings - Configure risk, indicators, universes

**Backend (FastAPI)**
- ✅ 18 REST endpoints (CRUD for positions/orders/config)
- ✅ Screener service (yfinance + Alpaca data providers)
- ✅ Portfolio management (R-based risk calculation)
- ✅ Daily Review service (combines screener + positions)
- ✅ Recommendation engine (checklist-based validation)

**Testing**
- ✅ 158 comprehensive tests (51 unit, 24 component, 87 integration)
- ✅ 80%+ coverage enforced
- ✅ MSW for API mocking, React Testing Library

**CLI**
- ✅ Screening, position management, backtesting
- ✅ Works alongside Web UI (shared data files)

### 🚧 What's Planned (Next Up)

**Currency Filter** (fully planned, ready to implement)
- Multi-currency support (USD, EUR) with filtering
- See: `~/.copilot/session.../plan.md` lines 100-558
- Estimated: 28-38 hours (~4-5 days)
- Phases: Backend detection → API → Web UI → CLI → Tests → Docs

**Future Vision** (not prioritized)
- Education refactor (see ROADMAP.md)
- Additional data providers
- Advanced backtesting features

---

## 📂 Where to Find Information

### Project Documentation

**Start Here:**
- `README.md` - Project overview, setup instructions
- `AGENTS.md` - **CRITICAL** - Philosophy, constraints, conventions
- `ROADMAP.md` - Feature roadmap, what's done vs. planned

**User Guides:**
- `docs/WEB_UI_GUIDE.md` - How to use the Web UI
- `docs/DAILY_USAGE_GUIDE.md` - Daily trading workflow
- `docs/OPERATIONAL_GUIDE.md` - CLI workflows

**Technical Guides:**
- `docs/DAILY_REVIEW_IMPLEMENTATION.md` - Daily Review patterns (NEW!)
- `PHASE1_IMPLEMENTATION_GUIDE.md` - Broker integration patterns
- `api/README.md` - API endpoint reference
- `web-ui/README.md` - React architecture

**Data & Structure:**
- `data/README.md` - Data directory structure (positions, orders, historical)

### Session State (Temporary Context)

**Location:** `~/.copilot/session-state/{session-id}/`

**Files you'll find:**
- `plan.md` - Current task breakdown with checkboxes
- `checkpoints/` - Prior conversation summaries
  - Read `index.md` to find relevant checkpoints
  - Each checkpoint has title indicating what was accomplished
- `files/` - Session artifacts (diagrams, analysis, etc.)

**How to use:**
1. **Starting fresh?** Read latest checkpoint for context
2. **Continuing work?** Check `plan.md` for current status
3. **Looking for decisions?** Search checkpoints by title

---

## 🧠 Critical Knowledge (Read Before Coding!)

### Project Philosophy (from AGENTS.md)

1. **Risk-First** - Prevent mistakes, don't just warn
2. **Deterministic** - No ML, no curve-fitting, no magic
3. **R-Multiples** - All risk as multiples of entry-stop distance
4. **Manual Execution** - System suggests, user decides
5. **Clarity > Cleverness** - Readable, testable, transparent

### Non-Goals (Important!)

**DO NOT:**
- Add live trading / broker APIs
- Add intraday logic
- Add ML models or predictive fitting
- Bypass risk rules for "better performance"
- Break existing tests without fixing them

### Key Conventions

**Backend (Python):**
- Type hints required
- snake_case naming
- Pandas for data (MultiIndex OHLCV format)
- Explicit > implicit

**Frontend (TypeScript):**
- camelCase naming
- Transform at API boundary (snake_case → camelCase)
- React Query for data fetching
- Zustand for global state
- Co-located tests

**Testing:**
- Update tests when changing behavior
- Maintain 80%+ coverage
- Mock at service boundary, not internals

---

## 🎓 Recent Implementation Learnings

### Daily Review Feature (Just Completed!)

**What it does:** Combines screener candidates + position management in one dashboard

**Critical patterns you must know:**

**1. PositionsResponse Bug** ⚠️
```python
# WRONG - Will cause AttributeError
for pos in portfolio.list_positions():

# CORRECT
response = portfolio.list_positions()
for pos in response.positions:
```

**2. Type Transformation**
```typescript
// Always transform at API boundary
function transformCandidate(api: CandidateAPI): Candidate {
  return { entryPrice: api.entry_price };  // snake → camel
}
```

**3. React Query Caching**
```typescript
// Manual refresh pattern for daily data
useQuery({
  staleTime: 1000 * 60 * 5,      // 5 minutes
  refetchOnWindowFocus: false,   // User controls refresh
})
```

**4. Recommendation Validation (CRITICAL)**
```typescript
// Create Order modal BLOCKS NOT_RECOMMENDED trades
if (!isRecommended) {
  setError('Not recommended - fix issues first');
  return;  // Safety mechanism - DO NOT bypass!
}
```

**Full guide:** `docs/DAILY_REVIEW_IMPLEMENTATION.md`

---

## 📋 Implementation Plans Available

### Completed ✅

**Daily Routine** (Branch: v2/daily-routine-revamp)
- Phase 1: Stop order synchronization ✅
- Phase 2: Daily Review API ✅
- Phase 3: Daily Review frontend ✅
- Phase 4: Recommendation modal ✅
- Phase 5: Refresh + Order creation ✅
- Status: Production ready, all tests passing

### Ready to Implement 🚀

**Currency Filter** (Fully Planned)
- **Location:** Session `plan.md` lines 100-558 (or `currency_filter_plan.md`)
- **Phases:**
  1. Backend: Currency detection utility + filtering
  2. API: Add currency field to models
  3. Web UI: Currency column + filter dropdown
  4. CLI: Currency display
  5. Testing: Full coverage
  6. Documentation: Update guides
- **Estimated effort:** 28-38 hours
- **Prerequisites:** None - ready to start
- **User requirements confirmed:** See plan lines 105-114

**How to start:**
1. Read full plan in session state
2. Begin with Phase 1 (Backend Foundation)
3. Create `src/swing_screener/data/currency.py`
4. Write tests first (TDD approach)

### Future Vision 💭

**Education Refactor** (Queued)
- Lower priority, no immediate plan
- See ROADMAP.md "Future Vision" section

---

## 🚀 Quick Start Checklist

### Starting a New Task

- [ ] Read `AGENTS.md` completely
- [ ] Check `ROADMAP.md` for priorities
- [ ] Review session `plan.md` if continuing work
- [ ] Read relevant implementation guide (e.g., `docs/DAILY_REVIEW_IMPLEMENTATION.md`)
- [ ] Check recent commits: `git log --oneline -20`
- [ ] Run tests to verify baseline: `pytest && cd web-ui && npm test`
- [ ] Ask user about priorities before large changes

### During Development

- [ ] Update `plan.md` as tasks complete (check off items)
- [ ] Follow existing patterns (see implementation guides)
- [ ] Write tests for new code
- [ ] Keep commits descriptive with context
- [ ] Update docs if behavior changes

### Before Completing

- [ ] All tests passing (backend + frontend)
- [ ] TypeScript compiles: `cd web-ui && npx tsc --noEmit`
- [ ] Coverage maintained (80%+)
- [ ] Docs updated if needed
- [ ] Create knowledge transfer doc for complex features

---

## 🗺️ Codebase Navigation

### Backend Structure

```
api/
├── models/          # Pydantic models (API contracts)
├── services/        # Business logic
├── routers/         # HTTP endpoints
└── main.py          # FastAPI app

src/swing_screener/
├── cli.py           # CLI entrypoint
├── data/            # Market data, providers
├── indicators/      # Technical indicators
├── screeners/       # Filtering & ranking
├── reporting/       # Output generation
├── portfolio/       # Position management
└── backtesting/     # Historical simulation

tests/
├── api/             # API service tests
├── data/            # Data provider tests
├── screeners/       # Screener logic tests
└── ...
```

### Frontend Structure

```
web-ui/src/
├── components/
│   ├── common/      # Button, Card, Badge, etc.
│   └── layout/      # Header, Sidebar, MainLayout
├── pages/           # 5 main pages (Dashboard, Screener, etc.)
├── features/        # Feature-specific code
│   ├── screener/
│   ├── portfolio/
│   └── dailyReview/
├── stores/          # Zustand state
├── types/           # TypeScript types + transforms
├── lib/             # API client (React Query)
└── test/            # Test infrastructure (MSW, utils)
```

### Key Entry Points

**Backend:**
- Start server: `uvicorn api.main:app --reload`
- Run tests: `pytest tests/`
- CLI: `python -m swing_screener.cli run`

**Frontend:**
- Dev server: `cd web-ui && npm run dev`
- Tests: `cd web-ui && npm test`
- Build: `cd web-ui && npm run build`

**Docker:**
- Full stack: `docker-compose up`

---

## 🔍 Common Debugging Scenarios

### Backend Tests Failing

**Check:**
1. Mock return types (PositionsResponse vs list)
2. Test data matches expected schema
3. Dependencies installed: `poetry install`

**Commands:**
```bash
pytest tests/api/test_daily_review_service.py -v  # Specific test
pytest -k "currency" -v                           # Filter by keyword
pytest --lf                                       # Last failed
```

### Frontend Tests Failing

**Check:**
1. MSW handlers return correct API shape
2. Types match backend (snake_case → camelCase)
3. Use `renderWithProviders()` for components

**Commands:**
```bash
cd web-ui
npm test                    # All tests
npm run test:ui            # Interactive mode
npm run test:coverage      # With coverage
npx tsc --noEmit           # Type check only
```

### API Not Working

**Check:**
1. Backend running: `curl http://localhost:8000/api/health`
2. CORS enabled for localhost:5173
3. Network tab in browser DevTools
4. Backend logs for errors

**Debug:**
```bash
# Check API directly
curl http://localhost:8000/api/daily-review?top_n=10

# Check specific endpoint
curl http://localhost:8000/api/positions
```

---

## 📊 Testing Strategy

### Backend (pytest)

**Pattern:** Mock at service boundary
```python
mock_screener.run_screener.return_value = ScreenerResponse(...)
mock_portfolio.list_positions.return_value = PositionsResponse(
    positions=[...],
    asof="2026-02-11"
)
```

**Coverage:**
- Unit tests for each service method
- Integration tests for API endpoints
- 80%+ coverage required

### Frontend (Vitest + RTL)

**Pattern:** Use `renderWithProviders()`
```typescript
import { renderWithProviders } from '@/test/utils';

test('displays candidates', async () => {
  renderWithProviders(<DailyReview />);
  await screen.findByText('New Trade Candidates');
});
```

**Coverage:**
- Unit tests (types, utils)
- Component tests (buttons, cards)
- Integration tests (full pages)
- MSW for API mocking

---

## 🎯 What to Implement Next?

### Priority 1: Currency Filter (Fully Planned)

**Why:** User requested, complete plan exists, high value

**Steps:**
1. Read full plan in session state (lines 100-558)
2. Start with Phase 1: Backend currency detection
3. Follow plan phases sequentially
4. Update plan.md as you complete tasks

**Starting file:** Create `src/swing_screener/data/currency.py`

**Estimated time:** 4-5 days

### Priority 2: Daily Review Modal Integration (Optional)

**Why:** Complete the Daily Review feature

**What's needed:**
- Update Stop modal reuse
- Close Position modal reuse
- Already implemented in other pages, just connect

**Estimated time:** 2-3 hours

### Priority 3: Documentation Updates

**What's missing:**
- Add Daily Review section to `docs/WEB_UI_GUIDE.md`
- Update `docs/DAILY_USAGE_GUIDE.md` with new workflow
- Add screenshots to documentation

**Estimated time:** 2-3 hours

---

## 💡 Tips for Success

### Communication with User

- **Ask before big changes** - Conservative project philosophy
- **Confirm requirements** - Use `ask_user` tool
- **Explain tradeoffs** - User values transparency
- **Show alternatives** - Let user decide approach

### Code Quality

- **Read existing code first** - Follow established patterns
- **Small, focused commits** - Easier to review/revert
- **Test before pushing** - Both backend and frontend
- **Document why, not what** - Future agents will thank you

### Knowledge Transfer

- **Update plan.md** - Keep current with progress
- **Write implementation guides** - For complex features
- **Descriptive commits** - Include context and rationale
- **Update AGENTS.md** - If you discover new patterns

---

## 🚨 Breaking Changes to Avoid

### Backend

- ❌ Don't change PositionsResponse structure (widely used)
- ❌ Don't modify R-multiple calculations (core logic)
- ❌ Don't bypass recommendation validation
- ❌ Don't auto-execute trades (always manual)

### Frontend

- ❌ Don't change transform function patterns
- ❌ Don't bypass validation in modals
- ❌ Don't break type safety (run `tsc --noEmit`)
- ❌ Don't reduce test coverage

### Data

- ❌ Don't modify positions.json format (user data!)
- ❌ Don't auto-save to git (check .gitignore)
- ❌ Don't change OHLCV MultiIndex format

---

## 📞 Getting Help

### In-Code Documentation

- **Docstrings:** Most Python services have detailed docstrings
- **Type hints:** TypeScript interfaces document expected shapes
- **Comments:** Explain "why" for non-obvious logic
- **Tests:** Show expected behavior

### External Resources

- **FastAPI docs:** https://fastapi.tiangolo.com/
- **React Query docs:** https://tanstack.com/query/latest
- **Pydantic docs:** https://docs.pydantic.dev/
- **Vitest docs:** https://vitest.dev/

### Ask the User

- Use `ask_user` tool for:
  - Design decisions
  - Scope clarifications
  - Priority questions
  - Breaking change approvals

---

## ✅ Success Criteria

You'll know you're doing well when:

- ✅ All tests pass (backend + frontend)
- ✅ TypeScript compiles without errors
- ✅ Coverage stays above 80%
- ✅ Code follows existing patterns
- ✅ User requirements are met
- ✅ Documentation is updated
- ✅ Knowledge is transferred (guides/commits)
- ✅ No regressions in existing features

---

## 🎓 Final Words

**This project values:**
- Simplicity over complexity
- Transparency over cleverness
- Risk control over performance
- Manual decisions over automation
- Tested code over "works on my machine"

**When in doubt:**
1. Read AGENTS.md
2. Check existing patterns
3. Ask the user
4. Make smallest possible change

**You've got this!** 🚀

The codebase is well-structured, thoroughly tested, and well-documented. Follow the patterns, respect the philosophy, and you'll do great.

---

_Last updated: 2026-02-11_  
_Next agent: Read this first, then dive into AGENTS.md!_
