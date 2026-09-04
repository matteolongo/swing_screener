# Frontend Reporting Remediation Design

**Status:** Approved in chat on 2026-09-04

**Scope:** Swing Screener Today, Last Run, Daily Review, symbol workspace, order review, API transforms, and their tests

**Source:** Evidence-based frontend review completed on 2026-09-04

## Purpose

Repair the reporting and daily-review defects found in the frontend audit without weakening the application's deterministic, risk-first trading model. The implementation must preserve backend authority for recommendations, keep historical screener runs immutable, make server-derived portfolio views refresh after relevant mutations, and fail closed whenever execution data is contradictory or incomplete.

## Goals

1. Prevent `SKIP`, malformed, stale, intraday, or incomplete candidates from becoming actionable order tickets.
2. Preserve the exact candidate and run selected by the user from Today or Last Run through every symbol-workspace panel.
3. Keep exploratory runs, Today's pinned run, and single-symbol analysis separate.
4. Refresh Daily Review whenever an order lifecycle transition changes its derived data.
5. Preserve null, unknown, currency, provenance, and freshness semantics at API boundaries.
6. Render independent Today sources independently during loading, error, and partial-data states.
7. Restore accessible row actions and predictable keyboard navigation.
8. Replace misleading or obsolete tests with contract-level regression coverage.

## Non-goals

- No live trading, broker integration, automatic order submission, or intraday strategy logic.
- No replacement of R-multiple sizing with dollar- or percentage-only logic.
- No redesign of unrelated pages or generic component-library overhaul.
- No machine-learning ranking or client-side reconstruction of backend workflow decisions.
- No migration of all handwritten API types in one pass; only the reporting and execution boundary covered here.

## Required invariants

- `recommendation.workflowStatus` and `recommendation.nextStep` remain server-authoritative.
- `decisionSummary.action` remains display-only and never authorizes order review.
- A candidate with `suggestedOrderType === "SKIP"` never receives or opens an entry-order workflow.
- The existing `waiting_trigger` / `wait_pullback` exception remains available only for a pending `BUY_LIMIT` approval token.
- Missing, zero, non-finite, or internally inconsistent trade-plan values remain unavailable and block execution.
- Today's pinned run is immutable and remains separate from subsequent exploratory and single-symbol runs.
- Rank and `priorityRank` stay server-owned.
- Intraday, stale, and degraded inputs cannot be labeled final or fresh.
- Preview requests remain read-only; mutations remain explicit and manual.
- API payloads are snake_case and convert to camelCase exactly once at the boundary.
- User-facing copy and test assertions use i18n keys.

## Architecture

### 1. Fail-closed execution eligibility

Introduce one pure execution-eligibility function in the recommendation/order boundary. It consumes the transformed candidate recommendation, suggested order type, approval token, data status/as-of value, plan values, same-symbol context, and persistence mode. It returns a discriminated result:

```ts
type OrderEligibility =
  | { allowed: true; mode: 'ready' | 'pending_pullback' }
  | {
      allowed: false;
      reason:
        | 'skip_guidance'
        | 'workflow_not_actionable'
        | 'approval_missing'
        | 'data_not_current'
        | 'plan_incomplete'
        | 'plan_invalid'
        | 'held_symbol_not_add_on';
    };
```

`ActionPanel` and `OrderReviewExperience` consume this result rather than independently reconstructing eligibility. The backend stops producing approval claims for `SKIP` and normalizes the contradictory ready/skip state to a non-actionable workflow. The UI retains a defensive `skip_guidance` block for legacy or corrupt persisted data.

Order defaults may prefill only from validated backend plan values. There is no synthetic `$100` entry, 5% stop, minimum-share fallback, or USD fallback. Missing values render as unavailable and keep submission disabled.

### 2. Source-aware workspace selection

Replace ticker-only selection with a stable selection envelope:

```ts
type WorkspaceSelection = {
  ticker: string;
  source: 'today_run' | 'last_run' | 'today_position' | 'today_watchlist' | 'portfolio' | 'ad_hoc';
  runId?: string;
  candidate?: ScreenerCandidate;
  rowId?: string;
};
```

`runId` is derived from immutable run metadata, using the saved completion timestamp plus request identity. The selected transformed candidate travels with run-backed selection so AnalysisCanvasPanel, SymbolAnalysisContent, workspace provenance, and ActionPanel all consume the same object. Components must not re-query `lastResult` independently by ticker.

The store may retain compatibility selectors during migration, but there is one write path and one canonical selection object. Tab changes do not replace position, watchlist, or pinned-run selections merely because the ticker is absent from Last Run.

### 3. Immutable run stores and an ad-hoc cache

Keep these concepts distinct:

- `lastResult`: the exact response from the most recent full/exploratory screener run.
- `todayRun`: the exact explicitly pinned response and its display filters.
- `adHocAnalyses`: ticker/request-keyed single-symbol responses used by the workspace only.

Single-symbol compute writes `adHocAnalyses` and never patches `lastResult` or `todayRun`. Each run envelope carries request, completion timestamp, strategy identity/revision, as-of date, and freshness. Strategy changes either invalidate actionable persisted runs or retain them as visibly historical, non-actionable snapshots. The implementation chooses invalidation for actionable views and may preserve an audit-only copy if an existing persistence contract requires it.

### 4. Mutation dependency invalidation

Create a single invalidation helper for order lifecycle transitions. Create, submit, cancel, fill, and DeGiro fill invalidate:

- orders;
- positions when fills can change them;
- portfolio summary and metrics;
- Daily Review;
- any position/order workspace source derived from those queries.

The helper accepts a transition kind so it invalidates only relevant position queries while always invalidating Daily Review. No optimistic Daily Review rewrite is required; invalidation and refetch remain the source of truth.

### 5. Independent Today composition

Today composes four sources: open positions, pending/order review, watchlist-near-trigger, and pinned candidates. Each source owns its loading, error, retry, and data state. One source failure does not hide successful sources.

The empty state is derived after composition and includes pending orders. Summary chips use actual displayed counts, including pinned candidates. Watchlist deduplication is performed against visible pinned candidates, so a filtered-out candidate cannot suppress a watchlist alert. Position-query errors render an explicit localized partial-error state.

Server trim suggestions are retained by adding trim metadata/action to the canonical open-position row. A second Holding section is not reintroduced. This removes the unused `HoldItem` rendering path while preserving the backend advisory action.

### 6. Contract-complete transformations

Update raw interfaces and transforms for reporting-relevant backend fields, including:

- candle `bar_pressure`;
- `intelligence_asof` and data-source provenance;
- quote/account currency;
- quote-denominated position size and risk;
- setup-quality metrics consumed by reporting or analysis.

Currency normalization matches the backend: exactly three ASCII letters, uppercased, and not `UNKNOWN` for actionable workflow parameters. GBP, CHF, and other valid codes remain intact. Unknown currency remains unknown and blocks currency-dependent execution; it is never coerced to USD.

Daily-review candidate fields that can be absent become nullable instead of zero-filled. Shared MSW fixtures use current backend-shaped snake_case payloads with workflow, approval, freshness, snapshot, exit-signal, and pending-order fields.

### 7. Freshness and accessibility

Workspace screener health maps domain provenance explicitly:

- final-close plus current data: `fresh`;
- intraday or degraded data: `partial`;
- stale data: `stale`;
- missing identity/provenance: `partial` or `idle` as appropriate.

Today action rows use sibling native buttons inside a semantic group rather than nested interactive elements. Keyboard movement is scoped to the Today list, uses stable row IDs, covers every visible row, and is suspended for form fields, contenteditable regions, ARIA textboxes, and open modal/dialog contexts.

## Delivery decomposition

The implementation will be delivered as five reviewable PRs after this planning PR:

1. **Make order eligibility fail closed** — backend `SKIP` normalization/token rejection, shared frontend eligibility, nullable plan values, and order regression tests.
2. **Preserve reporting selection and run identity** — source-aware selection, immutable run envelopes, separate ad-hoc cache, strategy invalidation, and divergent-run tests.
3. **Refresh and compose Daily Review correctly** — lifecycle invalidation, independent source states, visible-row counts/deduplication, trim integration, and MSW integration tests.
4. **Align reporting contracts and freshness** — currency validation, missing backend mappings, realistic mocks, source-health mapping, and contract tests.
5. **Repair interactions and test hygiene** — semantic row controls, scoped keyboard navigation, i18n cleanup, obsolete-test removal/merging, and documentation reconciliation.

PRs 1 and 2 can begin independently. PR 3 depends on the selection identity introduced by PR 2 for its end-to-end Today tests. PR 4 should merge before PR 5 so accessibility and copy tests use the final transformed fixtures.

## Testing strategy

Every implementation task follows red-green-refactor:

- Pure unit tests for order eligibility, currency normalization, plan validation, prioritization, and freshness mapping.
- Store tests for immutable run envelopes, source-aware selection, strategy transitions, and ad-hoc cache identity.
- Hook tests for mutation invalidation and request/cache keys.
- Component tests for Today partial states, watchlist deduplication, trim, malformed plans, and keyboard behavior.
- MSW integration tests for divergent pinned/last runs and complete backend-shaped responses.
- Accessibility checks for nested controls, accessible names, dialog isolation, and keyboard activation.
- One end-to-end path: pin run A, execute run B, select A from Today, review the same A candidate, create an order manually, and observe refreshed pending-order review.

Required frontend verification for every implementation PR:

```bash
cd web-ui
npm test
npm run typecheck
npm run lint
npm run build
npm run test:coverage
```

Relevant targeted suites run before the full suite. Backend-changing PRs additionally run their targeted `pytest` files and `pytest -m "not integration" -q`.

## Documentation impact

- Update `api/README.md` for `SKIP` normalization and approval-token eligibility if the public contract changes.
- Update `web-ui/docs/WEB_UI_ARCHITECTURE.md` for `WorkspaceSelection`, immutable runs, and cache ownership.
- Update `web-ui/docs/WEB_UI_GUIDE.md` to document the pending pullback exception consistently and describe partial Today rendering.
- Update the nearest backend/frontend READMEs when public interfaces change.
- Update `docs/overview/INDEX.md` for every new design or plan document.
- Record user-visible behavior changes in `CHANGELOG.md` under `Unreleased` in the implementation PR that introduces them.

## Acceptance criteria

- No `SKIP` or incomplete candidate can display an enabled order submission action.
- A Today candidate from run A remains run A in the header, analysis, and order context after run B exists.
- Single-symbol compute does not change Last Run candidates or metadata.
- Every order lifecycle mutation invalidates Daily Review.
- Today continues to show available sources when another source loads or fails.
- Missing plan values never display as valid zero-valued plans.
- Valid non-USD/EUR currencies survive transformation; unknown/malformed currency blocks execution.
- Intraday/stale/degraded source health is represented accurately.
- Today rows contain no nested interactive controls and shortcuts do not fire in editing/dialog contexts.
- Misleading and dead tests identified by the audit are corrected, consolidated, or removed with replacement coverage.
