# AGENTS.md — Swing Screener

This file defines **project scope, goals, structure, and conventions** for AI coding agents
(e.g. Codex, ChatGPT, Cursor, Copilot) working on this repository.

Agents should read this file **before making any changes**.

---

## Project summary

**Swing Screener** is a systematic swing-trading framework for US equities.

It is designed to:
- screen large universes of stocks
- generate rule-based trade candidates
- manage open positions via risk rules
- keep execution manual (Degiro / retail broker friendly)

The project explicitly prioritizes:
- simplicity
- reproducibility
- risk control
- low operational overhead

This is **not**:
- a high-frequency system
- an intraday trading bot
- an auto-execution platform

---

## High-level goals

1. Produce **daily swing-trade candidates**
2. Enforce **risk-first position sizing**
3. Manage trades via **R-multiples and trailing stops**
4. Minimize discretionary decisions
5. Keep all logic testable and deterministic

The system should be usable by:
- a single retail trader
- once per day
- after market close

---

## Non-goals (important)

Agents MUST NOT:
- add live trading / broker APIs
- add intraday logic
- add ML models or predictive fitting
- introduce hidden state or magic heuristics
- bypass risk rules for “better performance”

This project values **clarity over cleverness**.

---

## Repository structure (authoritative)

```
swing_screener/
├── docs/                 # Global docs (overview, engineering, education, product)
├── notebooks/            # Educational / exploratory notebooks
├── data/                 # Runtime JSON state (positions, orders, daily reviews)
├── src/swing_screener/
│   ├── cli.py            # Main CLI entrypoint
│   ├── data/             # Market data + universe loading
│   ├── indicators/       # Trend / momentum / volatility indicators
│   ├── screeners/        # Universe filtering & ranking
│   ├── reporting/        # Daily screener reports
│   ├── portfolio/        # Position state & management logic
│   └── backtesting/      # Historical simulation
├── tests/                # Unit tests (pytest)
└── pyproject.toml
```

Agents should respect this layout.

---

## Core concepts agents must understand

### 1. OHLCV format

Market data is always a Pandas DataFrame with:
- index = date
- columns = MultiIndex (field, ticker)

Example:
```
(Open, AAPL), (Close, MSFT), (Volume, NVDA)
```

Agents must preserve this convention.

---

### 2. Indicators philosophy

Indicators are:
- deterministic
- transparent
- explainable

Common indicators:
- SMA (trend)
- momentum returns (6m, 12m)
- ATR (volatility)

Agents should **not** introduce:
- complex oscillators
- curve-fitted parameters
- indicators that require intraday data

---

### 3. R-multiples (critical)

Risk is expressed in **R**, where:

```
1R = entry_price - stop_price
```

All trade management logic is based on:
- current R (`r_now`)
- breakeven rules
- trailing stops

Agents must preserve R-based reasoning.

---

## CLI philosophy

The CLI is the primary interface.

Principles:
- explicit commands (`run`, `manage`)
- no hidden defaults
- filesystem-based state (CSV / JSON / MD)

Agents should not:
- add interactive prompts
- require GUIs
- hide outputs in logs

---

## data/positions.json contract

`data/positions.json` is the **single source of truth** for open trades.

Agents must:
- never auto-create positions
- never auto-close trades silently
- only update stops when explicitly requested (`--apply`)

Schema changes require:
- backward compatibility
- clear migration notes

---

## Testing requirements

Any agent change must:
- include unit tests if logic changes
- avoid breaking existing tests
- prefer pure functions

Backtesting logic must remain:
- deterministic
- reproducible
- seed-independent

---

## Documentation rules

Documentation lives in `docs/` and in module-level `*/docs/` folders.

Agents should:
- update docs when behavior changes
- avoid duplicating content
- keep operational docs accurate

The most important docs:
- `docs/overview/INDEX.md`
- `docs/engineering/OPERATIONAL_GUIDE.md`
- `api/README.md`
- `web-ui/docs/WEB_UI_GUIDE.md`

---

## Style & constraints

- Python 3.11+
- Type hints preferred
- No unnecessary dependencies
- Pandas over NumPy unless performance-critical
- Explicit > implicit

Agents should favor:
- readability
- composability
- testability

---

## How agents should propose changes

Agents should:
1. Explain **why** a change is needed
2. Describe impact on users
3. Show minimal diff
4. Update tests
5. Update docs if needed

Large refactors must be justified.

---

## Web UI Architecture (new as of Feb 2026)

The system now includes a **full-stack web interface** in addition to the CLI.

### Backend (FastAPI)

Located in `api/`

Key details:
- 18 REST endpoints
- CRUD operations for positions, orders, config
- Screener execution via API
- CORS enabled for localhost:5173
- See `api/README.md` for endpoint reference

Agents should:
- preserve backward compatibility with CLI
- keep API responses consistent with types in `src/swing_screener/`
- maintain snake_case in API (Python convention)

---

### Frontend (React + TypeScript)

Located in `web-ui/`

Structure:
```
web-ui/
├── src/
│   ├── components/       # React components
│   │   ├── layout/       # Header, Sidebar, MainLayout
│   │   ├── common/       # Button, Card, Badge, HelpTooltip
│   │   └── domain/       # Feature-specific components
│   ├── pages/            # 5 main pages (Dashboard, Screener, Orders, Positions, Settings)
│   ├── stores/           # Zustand state management
│   ├── types/            # TypeScript type definitions
│   ├── lib/              # API client (React Query)
│   └── test/             # Test infrastructure
│       ├── setup.ts      # Vitest config
│       ├── utils.tsx     # renderWithProviders helper
│       └── mocks/        # MSW handlers
```

Key conventions:
- **camelCase** for frontend (TypeScript convention)
- Transform at API boundary: `transformPosition()`, `transformOrder()`
- Co-located tests: `Component.test.tsx` next to `Component.tsx`
- React Query for data fetching
- Zustand for global state (config, UI state)

---

### Testing (CRITICAL)

The project has **158 comprehensive tests**:
- 51 unit tests (types, utils, API client)
- 24 component tests (Button, Card, Badge)
- 87 integration tests (all 5 pages)

**Test stack:**
- Vitest (test runner)
- React Testing Library (component testing)
- MSW (API mocking at network level)
- Happy-DOM (lightweight DOM simulation)

**Coverage requirements:**
- 80%+ for lines, functions, statements
- 75%+ for branches
- Enforced in `web-ui/vitest.config.ts`

**Agents MUST:**
- Run existing tests before changes: `cd web-ui && npm test`
- Update tests when modifying components
- Maintain coverage thresholds
- Add tests for new features

**Test execution:**
```bash
cd web-ui
npm test              # Run all tests
npm run test:ui       # Interactive UI mode
npm run test:coverage # With coverage report
```

---

### Type Transformation Pattern

**Critical:** Backend uses snake_case, frontend uses camelCase.

**Backend API (snake_case):**
```python
{
  "entry_price": 100.0,
  "stop_price": 98.0,
  "limit_price": 99.5,
  "order_type": "LIMIT"
}
```

**Frontend TypeScript (camelCase):**
```typescript
{
  entryPrice: 100.0,
  stopPrice: 98.0,
  limitPrice: 99.5,
  orderType: "LIMIT"
}
```

**Transform at boundary:**
- `transformPosition()` in `web-ui/src/types/position.ts`
- `transformOrder()` in `web-ui/src/types/order.ts`
- `transformCreateOrderRequest()` for reverse

**Important:** `null` from backend → `undefined` in frontend for optional fields.

---

### React Component Patterns

**Naming:**
- PascalCase for components: `OrderCard.tsx`
- camelCase for utilities: `formatCurrency.ts`
- UPPER_SNAKE_CASE for constants: `DEFAULT_CONFIG`

**Structure:**
```typescript
// 1. Imports
import { useState } from 'react';
import { Button } from '@/components/common/Button';

// 2. Types (if needed)
interface Props {
  ticker: string;
  onClose: () => void;
}

// 3. Component
export function OrderModal({ ticker, onClose }: Props) {
  // Hooks first
  const [quantity, setQuantity] = useState(0);
  
  // Event handlers
  const handleSubmit = () => { /* ... */ };
  
  // Render
  return (/* ... */);
}
```

**Common patterns:**
- Use `renderWithProviders()` in tests (provides QueryClient + Router)
- Mock API with MSW handlers in `src/test/mocks/handlers.ts`
- Use `HelpTooltip` for educational content

---

### State Management

**Zustand stores:**
- `configStore` - App configuration (risk, indicators, manage)
- Additional stores as needed (minimal, prefer React Query)

**React Query:**
- Use for **all API calls**
- Provides caching, refetching, loading states
- Example:
  ```typescript
  const { data: positions, isLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: () => api.get('/api/positions').then(r => r.data)
  });
  ```

---

### File Modification Rules

**Agents should NOT:**
- Modify files in `web-ui/node_modules/`
- Modify generated files like `web-ui/dist/`
- Auto-format without preserving style
- Change test infrastructure without justification

**Agents should:**
- Respect existing component structure
- Follow TypeScript strict mode
- Keep components small and focused
- Test changes with `npm test`

---

## Documentation (updated Feb 2026)

Primary user docs:
- `web-ui/docs/WEB_UI_GUIDE.md` — comprehensive Web UI guide
- `docs/engineering/OPERATIONAL_GUIDE.md` — CLI workflows
- `docs/product/DAILY_USAGE_GUIDE.md` — daily routine

Technical docs:
- `api/README.md` — API reference
- `web-ui/README.md` — React architecture
- `README.md` — main entry point (updated for Web UI)
- `web-ui/docs/DAILY_REVIEW_IMPLEMENTATION.md` — Daily Review patterns and gotchas

---

## Implementation Learnings (Daily Review)

**Context:** Daily Review feature (v2/daily-routine-revamp) combines screener + position management.

### Critical Patterns Agents Must Know

**1. PositionsResponse Handling**

`PortfolioService.list_positions()` returns `PositionsResponse`, NOT a list:

```python
# WRONG - AttributeError!
for pos in portfolio.list_positions():

# CORRECT
response = portfolio.list_positions()
for pos in response.positions:
```

**2. Type Transformation at API Boundary**

Backend = snake_case, Frontend = camelCase. ALWAYS add transforms:

```typescript
function transformCandidate(api: CandidateAPI): Candidate {
  return { entryPrice: api.entry_price };  // snake → camel
}
```

**3. React Query Caching Pattern**

Daily data uses 5-min staleTime + manual refresh (user-controlled):

```typescript
useQuery({ staleTime: 1000*60*5, refetchOnWindowFocus: false })
```

**4. Recommendation Validation (Risk-First)**

Create Order modal BLOCKS NOT_RECOMMENDED trades:

```typescript
if (!isRecommended) {
  setError('Not recommended - fix issues first');
  return;  // Prevent submission
}
```

**5. Historical Tracking**

Daily reviews auto-save to `data/daily_reviews/daily_review_YYYY-MM-DD_strategy.json`
- Complete audit trail
- Gitignored (not committed)
- See `data/README.md`

**Full guide:** `web-ui/docs/DAILY_REVIEW_IMPLEMENTATION.md`

---

## Final note to agents

This project is intentionally conservative.

If a change:
- increases complexity
- adds automation risk
- reduces transparency
- breaks existing tests

…it is probably not desired.

When in doubt:
**ask before changing behavior.**

---

_End of AGENTS.md_
