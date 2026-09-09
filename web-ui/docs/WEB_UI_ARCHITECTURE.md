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

- Screener candidates preserve `technicalRank`, `confidenceRank`, and final
  `priorityRank`. List ordering reads `priorityRank`; legacy `rank` remains the
  technical-rank alias for older API payloads.
- Screener monetary values expose quote-currency prices and risks as `*Quote`,
  converted portfolio amounts as `*Account`, and carry `quoteCurrency` plus
  `accountCurrency`. UI view models consume the account-currency risk field;
  deprecated `*Usd` aliases remain typed only for compatibility.

- API payloads arrive as `snake_case`. Transform functions in `src/types/` convert to `camelCase` before use in components. Never use raw API shape inside components.
- Candidate workflow state is server-authoritative. Components consume
  transformed `workflowStatus` / `nextStep`; they do not re-derive precedence
  from decision gates or `decisionSummary.action`. Missing workflow fields fail
  safely to `needs_review` / `refresh_data` at the API boundary.
- A `waiting_trigger` / `wait_pullback` candidate may expose manual order review
  only with its pending `BUY_LIMIT` approval token. It remains distinct from
  `ready`, which means the observed entry trigger passed; the token is required
  and submission remains manual.
- React Query keys live in `src/lib/queryKeys.ts`. Always use these for cache invalidation — do not construct key arrays inline.
- All user-facing strings go through `src/i18n/`. No hardcoded copy in components or tests.

## State

- Server state: React Query (auto-caching and invalidation via query keys).
- Client/UI state: Zustand stores in `src/stores/`.
- No local persistence by default (`VITE_PERSISTENCE_MODE=api`).

Local persistence is a storage choice, not a second trading engine.
`features/persistence/portfolioService.ts` serializes the browser snapshot and
dispatches `/api/portfolio/state/commands`; backend services own lifecycle,
approval, risk, fee and FX calculations. A Web Lock serializes command execution
across tabs, and the adapter compares the stored state before accepting the
response. Revision, idempotency receipts, orders, positions and returned active
strategy are persisted together only on success. Retried requests retain their
explicit effective time and new-position identity. Missing Web Locks fails closed.
Local position metrics and summaries use the read-only `/api/portfolio/state/metrics`
projection; these read models never replace the stored snapshot. Browser ledger
freshness stays unknown rather than inheriting server-database freshness.

`UpdateStopRequest.marketPrice` carries the caller's ticker, price, observation
timestamp and `current` status in local mode. It must come from an actual observed
quote or explicit user observation; adapters do not relabel stored prices as fresh.
Close and partial-close success invalidate linked order queries as well as position
and review queries, because canonical commands may replace or cancel exit orders.

### Symbol workspace ownership

The Today workspace keeps only session and layout state in
`workspaceStore`: normalized selected ticker, selection version, source,
active analysis tab, expanded/split mode, full-screen mode, and activity-drawer
visibility plus a bounded history of 20 request activities per ticker/version
session. The drawer filters history to the live selection so an earlier symbol
cannot be retried against the current workspace.
Each activity has a request ID and an active/completed/partial/failed/discarded
lifecycle. Query fetching transitions and explicit mutations both allocate
request IDs, and a successful same-source retry supersedes its older failure.
Selecting a different ticker increments the selection version; late completions
are retained as discarded history but cannot update or appear in the current
symbol presentation.

React Query remains the sole owner of fundamentals, OHLCV, intelligence,
position, and order server data. `features/workspaceData/useSymbolWorkspaceData`
composes those canonical queries into source-health read models without copying
responses into Zustand. A screener rerun updates only screener-owned state;
fundamentals and intelligence retain their own timestamps. Refreshing
fundamentals replaces the canonical snapshot shared by Overview and
Fundamentals and can mark older intelligence outdated. Source health is a
current snapshot derived from server-owned provenance and content dates; it is
separate from request activity history.

The sticky workspace header, per-source status bar, and activity drawer expose
provider, data/fetch time, cached/stale/partial states, active work, and durable
failures. Evidence collection uses its dedicated read-only refresh endpoint.
Intelligence generation is a separate explicit action and records the precise
input manifest and per-source degradation. Neither action mutates trading
state. Backtest is not included in this health model and preserves its existing
query and run/reset behavior.

When the Today workspace is expanded, the mounted Today, Last Run, or Watchlist
panel renders its compact symbol-rail variant from the same loaded collection.
Collapsing switches that same component back to its full controls and table, so
tab, filter, and query ownership do not move or reset.

## Testing

- Component tests use `renderWithProviders()` — wraps React Query client and Zustand stores.
- API calls mocked via MSW (`src/test/mocks/handlers.ts`).
- Run all tests: `npm test` (Vitest + React Testing Library).
- Run single feature: `npx vitest run src/features/<domain>`.
