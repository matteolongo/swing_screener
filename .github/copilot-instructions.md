# GitHub Copilot Instructions — Swing Screener

This file provides guidance for GitHub Copilot when working on this repository.

---

## 📚 Primary Reference: AGENTS.md

**Before making any changes, read [AGENTS.md](../AGENTS.md) in the repository root.**

AGENTS.md is the authoritative guide covering:
- Project philosophy and constraints
- Repository structure and conventions
- Testing requirements and patterns
- Web UI architecture (React + TypeScript)
- Backend API patterns (FastAPI)
- Type transformation patterns (snake_case ↔ camelCase)
- Documentation rules

---

## Quick Reference for Copilot

### Project Overview

**Swing Screener** is a systematic swing-trading framework for equities that:
- Screens stock universes with rule-based filters
- Generates daily trade candidates post-market-close
- Manages positions with R-based risk rules
- Prioritizes simplicity, reproducibility, and risk control

**Key Constraint:** This is NOT a high-frequency, intraday, or auto-execution system.

---

### Technology Stack

**Backend (Python):**
- Python 3.11+
- FastAPI (REST API with 18 endpoints)
- Pandas (OHLCV data handling with MultiIndex columns)
- pytest (testing framework)

**Frontend (TypeScript):**
- React 18 + TypeScript (strict mode)
- Vite (build tool)
- React Query (data fetching)
- Zustand (state management)
- Vitest + React Testing Library + MSW (testing)

---

### Critical Conventions

#### 1. Data Format: OHLCV MultiIndex
```python
# Market data is always a Pandas DataFrame:
# - index = date
# - columns = MultiIndex (field, ticker)
# Example: (Open, AAPL), (Close, MSFT), (Volume, NVDA)
```

#### 2. Type Transformations (Backend ↔ Frontend)
```python
# Backend (Python): snake_case
{"entry_price": 100.0, "stop_price": 98.0}
```
```typescript
// Frontend (TypeScript): camelCase
{entryPrice: 100.0, stopPrice: 98.0}
```
**ALWAYS transform at API boundary** using `transformPosition()`, `transformOrder()`, etc.

#### 3. R-Multiples (Risk Management)
```python
# Risk is expressed in R:
1R = entry_price - stop_price

# All position management uses R-based reasoning:
# - current R (r_now)
# - breakeven rules
# - trailing stops
```

#### 4. State Files (Single Source of Truth)
- `data/positions.json` - Open trades (never auto-create/close)
- `data/orders.json` - Order lifecycle state
- `config.json` - Application configuration

---

### Testing Requirements

**Backend:**
- Run `pytest` before and after changes
- Include unit tests for logic changes
- Prefer pure functions
- Maintain deterministic behavior

**Frontend:**
- Run `cd web-ui && npm test` before and after changes
- 158 comprehensive tests (51 unit, 24 component, 87 integration)
- Coverage thresholds enforced: 80%+ lines, 75%+ branches
- Use `renderWithProviders()` for component tests
- Mock APIs with MSW handlers

---

### Anti-Patterns (DO NOT)

❌ Add live trading / broker APIs  
❌ Add intraday logic or high-frequency features  
❌ Add ML models or curve-fitting  
❌ Introduce hidden state or magic heuristics  
❌ Bypass risk rules for "better performance"  
❌ Auto-create or auto-close positions  
❌ Remove or modify working code unnecessarily  
❌ Add interactive prompts to CLI  
❌ Modify `web-ui/node_modules/` or generated files

---

### Code Style

**Python:**
- Type hints preferred
- Explicit > implicit
- Pandas over NumPy unless performance-critical

**TypeScript:**
- PascalCase for components: `OrderCard.tsx`
- camelCase for utilities: `formatCurrency.ts`
- UPPER_SNAKE_CASE for constants: `DEFAULT_CONFIG`

---

### Documentation

When changing behavior:
- Update relevant docs in `docs/` and module-level `*/docs/` folders
- Keep docs accurate, avoid duplication
- Most important: `OPERATIONAL_GUIDE.md`, `CLI.md`, `WEB_UI_GUIDE.md`

---

### Proposing Changes

1. Explain **why** the change is needed
2. Describe impact on users
3. Show minimal diff
4. Update tests
5. Update docs if needed

**Large refactors must be justified.**

---

## 🚨 Important

This project is **intentionally conservative**.

If a change:
- increases complexity
- adds automation risk
- reduces transparency
- breaks existing tests

…it is probably not desired.

**When in doubt: ask before changing behavior.**

---

## Additional Resources

- **[WELCOME.md](../docs/overview/WELCOME.md)** - New contributor onboarding
- **[ROADMAP.md](../docs/engineering/ROADMAP.md)** - Feature status and priorities
- **[README.md](../README.md)** - Project setup and usage
- **[docs/WEB_UI_GUIDE.md](../web-ui/docs/WEB_UI_GUIDE.md)** - Complete Web UI documentation
- **[docs/DAILY_REVIEW_IMPLEMENTATION.md](../web-ui/docs/DAILY_REVIEW_IMPLEMENTATION.md)** - Recent implementation patterns

---

_For complete details, see [AGENTS.md](../AGENTS.md) in the repository root._
