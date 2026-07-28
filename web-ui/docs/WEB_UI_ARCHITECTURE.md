# Web UI Architecture

> Status: current.  
> Last reviewed: 2026-07-28.

## Directory Structure

| Path | Purpose |
|------|---------|
| `src/pages/` | Top-level page components — one file per route |
| `src/features/` | Domain feature dirs — each owns `api.ts`, `hooks.ts`, and types |
| `src/components/domain/` | Reusable domain components (not page-specific) |
| `src/components/common/` | Generic UI primitives |
| `src/types/` | Type transforms: `snake_case` API payload → `camelCase` frontend type |
| `src/lib/` | Shared React Query keys (`queryKeys.ts`), API endpoint constants (`api.ts`) |
| `src/i18n/` | All user-facing strings |
| `src/stores/` | Zustand stores |
| `src/test/` | MSW handlers, `renderWithProviders()`, test utilities |

## Contracts

- API payloads arrive as `snake_case`. Transform functions in `src/types/` convert to `camelCase` before use in components. Never use raw API shape inside components.
- Candidate workflow state is server-authoritative. Components consume
  transformed `workflowStatus` / `nextStep`; they do not re-derive precedence
  from decision gates or `decisionSummary.action`. Missing workflow fields fail
  safely to `needs_review` / `refresh_data` at the API boundary.
- React Query keys live in `src/lib/queryKeys.ts`. Always use these for cache invalidation — do not construct key arrays inline.
- All user-facing strings go through `src/i18n/`. No hardcoded copy in components or tests.

## State

- Server state: React Query (auto-caching and invalidation via query keys).
- Client/UI state: Zustand stores in `src/stores/`.
- No local persistence by default (`VITE_PERSISTENCE_MODE=api`).

### Symbol workspace ownership

The Today workspace keeps only session and layout state in
`workspaceStore`: normalized selected ticker, selection version, source,
active analysis tab, expanded/split mode, full-screen mode, and activity-drawer
visibility. Selecting a different ticker increments the selection version;
late completions must match both ticker and version before presentation.

React Query remains the sole owner of fundamentals, OHLCV, intelligence,
position, and order server data. `features/workspaceData/useSymbolWorkspaceData`
composes those canonical queries into source-health read models without copying
responses into Zustand. A screener rerun updates only screener-owned state;
fundamentals and intelligence retain their own timestamps. Refreshing
fundamentals replaces the canonical snapshot shared by Overview and
Fundamentals and can mark older intelligence outdated.

The sticky workspace header, per-source status bar, and activity drawer expose
provider, data/fetch time, cached/stale/partial states, active work, and durable
failures. Evidence collection uses its dedicated read-only refresh endpoint.
Intelligence generation is a separate explicit action and records the precise
input manifest and per-source degradation. Neither action mutates trading
state. Backtest is not included in this health model and preserves its existing
query and run/reset behavior.

## Testing

- Component tests use `renderWithProviders()` — wraps React Query client and Zustand stores.
- API calls mocked via MSW (`src/test/mocks/handlers.ts`).
- Run all tests: `npm test` (Vitest + React Testing Library).
- Run single feature: `npx vitest run src/features/<domain>`.
